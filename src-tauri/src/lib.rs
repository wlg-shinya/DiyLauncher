mod bridge;
mod config;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Err(err) = config::ensure_config_exists(app.handle()) {
                eprintln!("[Error] 初期ファイル生成エラー: {}", err);
            }

            if let Err(err) = config::apply_window_icon(app.handle()) {
                eprintln!("[Error] アイコン設定エラー: {}", err);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bridge::load_config,
            bridge::run_command_with_log,
            bridge::get_command_output
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}