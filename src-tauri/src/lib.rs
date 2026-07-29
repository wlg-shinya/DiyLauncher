use tauri::{AppHandle, Emitter};
use std::process::Command;
mod bridge;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bridge::load_config,
            bridge::run_command_with_log,
            bridge::get_command_output
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}