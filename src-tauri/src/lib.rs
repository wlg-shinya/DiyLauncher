use std::fs::{self, OpenOptions};
use std::io::Write;
use std::process::Command;
use chrono::Local;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchItem {
    pub name: String,
    pub command: String,
    pub args: Option<Vec<String>>,
}

#[tauri::command]
fn read_config_xml(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("XMLの読み込みエラー: {}", e))
}

#[tauri::command]
fn execute_launch_command(command: String, args: Vec<String>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let mut cmd = Command::new("cmd");
    #[cfg(target_os = "windows")]
    cmd.args(["/C", &command]);

    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new(&command);

    if !args.is_empty() {
        cmd.args(&args);
    }

    match cmd.spawn() {
        Ok(_) => Ok(format!("実行成功: {}", command)),
        Err(e) => Err(format!("コマンド実行失敗: {}", e)),
    }
}

#[tauri::command]
fn write_log(log_path: String, message: String) -> Result<(), String> {
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let log_entry = format!("[{}] {}\n", now, message);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("ログファイル作成エラー: {}", e))?;

    file.write_all(log_entry.as_bytes())
        .map_err(|e| format!("ログ書き込みエラー: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_config_xml,
            execute_launch_command,
            write_log
        ])
        .run(tauri::generate_context!())
        .expect("アプリの実行中にエラーが発生しました");
}