use encoding_rs::SHIFT_JIS;
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
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
            let _ = Command::new("pkill")
                .args(["-9", "-P", &pid.to_string()])
                .output();
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

        // ログファイルの準備（失敗時はUIのログ欄へ警告を表示して処理自体は続行する）
        let log_writer = match prepare_log_file(&log_file, &log_mode) {
            Ok(writer) => writer,
            Err(err_msg) => {
                let warn_msg = format!("[Warning] {}\n", err_msg);
                emit_output(&app, &target_id, cmd_pid.as_deref(), &warn_msg, "stderr");
                None
            }
        };
        // ログ書き込み用の共有参照。後続の共通処理でも書き込めるように Arc<Mutex<>> 化しておく
        let writer_arc = log_writer.map(|w| Arc::new(Mutex::new(w)));

        // コマンドストリーミング実行
        let mut cmd = create_command(&command);

        // コマンドの標準出力設定
        if detach {
            cmd.stdout(Stdio::null()).stderr(Stdio::null());
        } else {
            cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
        }

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let err_msg = format!("プロセスの起動に失敗しました: {}\n", e);
                emit_output(&app, &target_id, cmd_pid.as_deref(), &err_msg, "stderr");
                return;
            }
        };

        let pid = child.id();
        let exit_code: i32;

        if detach {
            emit_output(
                &app,
                &target_id,
                cmd_pid.as_deref(),
                "[Detached process started]\n",
                "stdout",
            );
            // デタッチ時は終了を待たないので仮の成功コードとして扱う
            exit_code = 0;
        } else {
            process_state_cloned.add(cmd_pid.as_deref(), pid);

            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            let stdout_handle = spawn_reader_thread(
                stdout,
                app.clone(),
                target_id.clone(),
                writer_arc.clone(),
                cmd_pid.clone(),
                "stdout",
            );

            let stderr_handle = spawn_reader_thread(
                stderr,
                app.clone(),
                target_id.clone(),
                writer_arc.clone(),
                cmd_pid.clone(),
                "stderr",
            );

            // パイプ読み込みスレッドの完了を待機
            let _ = stdout_handle.join();
            let _ = stderr_handle.join();

            // プロセス終了待機 & 経過時間計算
            let status = child.wait();
            process_state_cloned.remove(cmd_pid.as_deref(), pid);

            // 実際のプロセスの終了コードを取得
            exit_code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
        }

        let elapsed = start_time.elapsed();
        let hours = elapsed.as_secs() / 3600;
        let minutes = (elapsed.as_secs() % 3600) / 60;
        let seconds = elapsed.as_secs() % 60;
        let millis = elapsed.subsec_millis();
        let time_str = format!("{:02}:{:02}:{:02}.{:03}", hours, minutes, seconds, millis);
        let exit_msg = format!(
            "\n[Process exited with code: {} (Elapsed: {})]\n",
            exit_code, time_str
        );

        // UIへ終了イベントを送信
        emit_output(&app, &target_id, cmd_pid.as_deref(), &exit_msg, "exit");

        // ログファイルにも終了文を追記
        if let Some(ref w) = writer_arc {
            if let Ok(mut file) = w.lock() {
                let _ = file.write_all(exit_msg.as_bytes());
            }
        }
    });

    Ok(())
}

fn spawn_reader_thread<R: Read + Send + 'static>(
    stream: Option<R>,
    app: AppHandle,
    target_id: String,
    writer: Option<Arc<Mutex<File>>>,
    cmd_pid: Option<String>,
    output_type: &'static str,
) -> JoinHandle<()> {
    std::thread::spawn(move || {
        if let Some(stream) = stream {
            let mut reader = BufReader::new(stream);
            let mut line_buf = Vec::new();

            loop {
                line_buf.clear();
                match read_until_newline(&mut reader, &mut line_buf) {
                    Ok(0) => break, // EOF
                    Ok(_) => {
                        let text = decode_bytes(&line_buf);
                        emit_output(&app, &target_id, cmd_pid.as_deref(), &text, output_type);
                        if let Some(ref w) = writer {
                            if let Ok(mut file) = w.lock() {
                                let _ = file.write_all(text.as_bytes());
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
        }
    })
}

fn read_until_newline<R: BufRead>(reader: &mut R, buf: &mut Vec<u8>) -> std::io::Result<usize> {
    const MAX_LINE_BYTES: usize = 65536;
    let mut total_read = 0;

    loop {
        let available = match reader.fill_buf() {
            Ok(n) => n,
            Err(ref e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e),
        };

        if available.is_empty() {
            break;
        }

        let mut found_end = None;
        for (i, &b) in available.iter().enumerate() {
            if b == b'\n' {
                found_end = Some(i + 1);
                break;
            } else if b == b'\r' {
                // \r\n の場合は \n までまとめて1行として扱う
                if i + 1 < available.len() && available[i + 1] == b'\n' {
                    found_end = Some(i + 2);
                } else {
                    found_end = Some(i + 1);
                }
                break;
            }
        }

        let consume_len = found_end.unwrap_or(available.len());
        buf.extend_from_slice(&available[..consume_len]);
        reader.consume(consume_len);
        total_read += consume_len;

        if found_end.is_some() || buf.len() >= MAX_LINE_BYTES {
            break;
        }
    }

    Ok(total_read)
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

fn prepare_log_file(
    log_file: &Option<String>,
    log_mode: &Option<String>,
) -> Result<Option<File>, String> {
    let Some(file_path_str) = log_file.as_ref() else {
        return Ok(None);
    };

    if file_path_str.trim().is_empty() {
        return Ok(None);
    }

    let path = PathBuf::from(file_path_str);

    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "ログディレクトリの作成に失敗しました ({}): {}",
                    parent.display(),
                    e
                )
            })?;
        }
    }

    let is_append = log_mode.as_deref() == Some("append");

    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(!is_append)
        .append(is_append)
        .open(&path)
        .map_err(|e| format!("ログファイルを開けませんでした ({}): {}", path.display(), e))?;

    Ok(Some(file))
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