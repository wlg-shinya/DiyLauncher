use encoding_rs::SHIFT_JIS;

pub fn decode_bytes(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => {
            let (res, _, _) = SHIFT_JIS.decode(bytes);
            res.into_owned()
        }
    }
}

pub async fn get_command_output(command: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        use std::os::windows::process::CommandExt;

        println!("get_command_output: {}", command);

        let output = if cfg!(target_os = "windows") {
            let mut cmd = std::process::Command::new("cmd");
            cmd.args(["/C", &command]);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            cmd.output()
        } else {
            let mut cmd = std::process::Command::new("sh");
            cmd.args(["-c", &command]);
            cmd.output()
        };

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