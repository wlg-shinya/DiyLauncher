use tauri::{AppHandle, Emitter};
use std::process::Command;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ConfigData {
    pub head: String,
    pub body: String,
    pub version: String,
}

#[tauri::command]
async fn load_config(app: tauri::AppHandle) -> Result<ConfigData, String> {
    let version = app.package_info().version.to_string();

    // TODO: Electron の readConfig / convertToConfigData の移植
    Ok(ConfigData {
        head: String::new(),
        body: String::new(),
        version: version,
    })
}

#[tauri::command]
async fn run_command_with_log(
    app: AppHandle,
    command: String,
    log_id: Option<String>,
    log_file: Option<String>,
    log_mode: Option<String>,
) -> Result<(), String> {
    // TODO: Electron の spawn / activeProcesses の管理 / イベント送信 (app.emit) の移植
    Ok(())
}

#[tauri::command]
async fn get_command_output(command: String) -> Result<String, String> {
    // TODO: Electron の exec (buffer) / iconv-lite (文字コード変換) の移植
    Ok(String::new())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_config,
            run_command_with_log,
            get_command_output
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}