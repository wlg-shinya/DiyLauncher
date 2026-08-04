use encoding_rs::SHIFT_JIS;
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Default, Clone)]
pub struct ProcessState {
    named: Arc<Mutex<HashMap<String, u32>>>,
    anonymous: Arc<Mutex<Vec<u32>>>,
}

impl ProcessState {
    pub fn add(&self, cmd_pid: Option<&str>, pid: u32) {
        if let Some(key) = cmd_pid {
            if !key.is_empty() {
                if let Ok(mut map) = self.named.lock() {
                    map.insert(key.to_string(), pid);
                }
                return;
            }
        }
        if let Ok(mut vec) = self.anonymous.lock() {
            vec.push(pid);
        }
    }

    pub fn remove(&self, cmd_pid: Option<&str>, pid: u32) {
        if let Some(key) = cmd_pid {
            if !key.is_empty() {
                if let Ok(mut map) = self.named.lock() {
                    if map.get(key) == Some(&pid) {
                        map.remove(key);
                    }
                }
                return;
            }
        }
        if let Ok(mut vec) = self.anonymous.lock() {
            vec.retain(|&id| id != pid);
        }
    }

    pub fn kill_by_cmd_pid(&self, cmd_pid: &str) {
        let pid = if let Ok(mut map) = self.named.lock() {
            map.remove(cmd_pid)
        } else {
            None
        };

        if let Some(pid) = pid {
            Self::kill_pid_tree(pid);
        }
    }

    pub fn kill_all(&self) {
        if let Ok(mut map) = self.named.lock() {
            for (_, pid) in map.drain() {
                Self::kill_pid_tree(pid);
            }
        }
        if let Ok(mut vec) = self.anonymous.lock() {
            for pid in vec.drain(..) {
                Self::kill_pid_tree(pid);
            }
        }
    }

    fn kill_pid_tree(pid: u32) {
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .creation_flags(0x08000000)
                .output();
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
    }
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommandOutput {
    pub target_id: String,
    pub text: String,
    #[serde(rename = "type")]
    pub r#type: String,
    pub cmd_pid: Option<String>,
}

pub fn decode_bytes(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => {
            let (res, _, _) = SHIFT_JIS.decode(bytes);
            res.into_owned()
        }
    }
}

pub async fn kill_process(
    process_state: State<'_, ProcessState>,
    cmd_pid: String,
) -> Result<(), String> {
    let process_state_cloned = process_state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        process_state_cloned.kill_by_cmd_pid(&cmd_pid);
    })
    .await
    .map_err(|e| format!("プロセスの停止に失敗しました: {}", e))
}

pub async fn get_command_output(command: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        println!("get_command_output: {}", command);

        // コマンドバッチ実行
        let mut cmd = create_command(&command);
        let output = cmd.output();

        match output {
            Ok(out) => {
                if !out.status.success() {
                    let err_str = decode_bytes(&out.stderr);
                    if !err_str.trim().is_empty() {
                        return Ok(err_str.trim().to_string());
                    }
                }
                let stdout_str = decode_bytes(&out.stdout);
                Ok(stdout_str.trim().to_string())
            }
            Err(e) => Err(format!("コマンドの実行に失敗しました: {}", e)),
        }
    })
    .await
    .map_err(|e| format!("タスクの実行エラー: {}", e))?
}

pub async fn run_command_with_log(
    app: AppHandle,
    process_state: State<'_, ProcessState>,
    command: String,
    log_id: Option<String>,
    log_file: Option<String>,
    log_mode: Option<String>,
    detach: bool,
    cmd_pid: Option<String>,
) -> Result<(), String> {
    let process_state_cloned = process_state.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let start_time = Instant::now();
        let target_id = log_id.unwrap_or_default();

        // ログファイルの準備
        let log_writer = prepare_log_file(&log_file, &log_mode);

        // コマンドストリーミング実行
        let mut cmd = create_command(&command);
        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let err_msg = format!("プロセスの起動に失敗しました: {}\n", e);
                emit_output(&app, &target_id, cmd_pid.as_deref(), &err_msg, "stderr");
                return;
            }
        };

        let pid = child.id();
        if !detach {
            process_state_cloned.add(cmd_pid.as_deref(), pid);
        }

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // ログ書き込み用の共有参照
        let writer_arc = log_writer.map(|w| Arc::new(Mutex::new(w)));

        // stdout 読み込み用スレッド
        let app_stdout = app.clone();
        let target_stdout = target_id.clone();
        let writer_stdout = writer_arc.clone();
        let cmd_pid_stdout = cmd_pid.clone();
        let stdout_handle = std::thread::spawn(move || {
            if let Some(mut stream) = stdout {
                let mut buf = [0u8; 1024];
                while let Ok(n) = stream.read(&mut buf) {
                    if n == 0 { break; }
                    let text = decode_bytes(&buf[..n]);
                    emit_output(&app_stdout, &target_stdout, cmd_pid_stdout.as_deref(), &text, "stdout");
                    if let Some(ref w) = writer_stdout {
                        if let Ok(mut file) = w.lock() {
                            let _ = file.write_all(text.as_bytes());
                        }
                    }
                }
            }
        });

        // stderr 読み込み用スレッド
        let app_stderr = app.clone();
        let target_stderr = target_id.clone();
        let writer_stderr = writer_arc.clone();
        let cmd_pid_stderr = cmd_pid.clone();
        let stderr_handle = std::thread::spawn(move || {
            if let Some(mut stream) = stderr {
                let mut buf = [0u8; 1024];
                while let Ok(n) = stream.read(&mut buf) {
                    if n == 0 { break; }
                    let text = decode_bytes(&buf[..n]);
                    emit_output(&app_stderr, &target_stderr, cmd_pid_stderr.as_deref(), &text, "stderr");
                    if let Some(ref w) = writer_stderr {
                        if let Ok(mut file) = w.lock() {
                            let _ = file.write_all(text.as_bytes());
                        }
                    }
                }
            }
        });

        // パイプ読み込みスレッドの完了を待機
        let _ = stdout_handle.join();
        let _ = stderr_handle.join();

        // プロセス終了待機 & 経過時間計算
        let status = child.wait();

        if !detach {
            process_state_cloned.remove(cmd_pid.as_deref(), pid);
        }

        let elapsed = start_time.elapsed();
        let hours = elapsed.as_secs() / 3600;
        let minutes = (elapsed.as_secs() % 3600) / 60;
        let seconds = elapsed.as_secs() % 60;
        let millis = elapsed.subsec_millis();
        let time_str = format!("{:02}:{:02}:{:02}.{:03}", hours, minutes, seconds, millis);
        let exit_code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
        let exit_msg = format!("\n[Process exited with code: {} (Elapsed: {})]\n", exit_code, time_str);

        // 終了通知メッセージの送信
        emit_output(&app, &target_id, cmd_pid.as_deref(), &exit_msg, "exit");

        if let Some(ref w) = writer_arc {
            if let Ok(mut file) = w.lock() {
                let _ = file.write_all(exit_msg.as_bytes());
            }
        }
    });

    Ok(())
}

fn emit_output(app: &AppHandle, target_id: &str, cmd_pid: Option<&str>, text: &str, output_type: &str) {
    let payload = CommandOutput {
        target_id: target_id.to_string(),
        text: text.to_string(),
        r#type: output_type.to_string(),
        cmd_pid: cmd_pid.map(|s| s.to_string()),
    };
    let _ = app.emit("on-command-output", payload);
}

fn prepare_log_file(log_file: &Option<String>, log_mode: &Option<String>) -> Option<File> {
    let file_path_str = log_file.as_ref()?;
    let path = PathBuf::from(file_path_str);

    // 親ディレクトリが存在しない場合は作成
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let is_append = log_mode.as_deref() == Some("append");

    OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(!is_append)
        .append(is_append)
        .open(path)
        .ok()
}

fn create_command(src: &str) -> Command {
    #[cfg(target_os = "windows")]
    {
        let mut c = Command::new("cmd");
        c.raw_arg(format!("/S /C \"{}\"", src));
        c.creation_flags(0x08000000); // CREATE_NO_WINDOW
        c
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut c = Command::new("sh");
        c.args(["-c", src]);
        c
    }
}