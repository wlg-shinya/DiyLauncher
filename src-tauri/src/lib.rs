mod bridge;
mod command;
mod config;

use command::ProcessState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProcessState::default())
        .setup(|app| {
            let handle = app.handle();

            if let Err(err) = config::ensure_config_exists(handle) {
                eprintln!("[Error] 初期ファイル生成エラー: {}", err);
            }

            if let Err(err) = config::apply_window_icon(handle) {
                eprintln!("[Error] アイコン設定エラー: {}", err);
            }

            if let Ok(xml_str) = config::read_config_xml() {
                let version = handle.package_info().version.to_string();
                let parsed = config::parse_config_xml(&xml_str, &version);
                config::apply_window_settings(handle, &parsed);
            }

            config::setup_config_watcher(handle.clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bridge::load_config,
            bridge::run_command_with_log,
            bridge::get_command_output
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<ProcessState>();
                state.kill_all();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}