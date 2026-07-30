mod bridge;
mod config;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();

            if let Err(err) = config::ensure_config_exists(handle) {
                eprintln!("[Error] 初期ファイル生成エラー: {}", err);
            }

            if let Err(err) = config::apply_window_icon(handle) {
                eprintln!("[Error] アイコン設定エラー: {}", err);
            }

            if let Ok(xml_str) = config::read_config_xml() {
                let parsed = config::parse_config_xml(&xml_str);
                config::apply_window_size(
                    handle, 
                    parsed.width as f64, 
                    parsed.height as f64
                );
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
                // TODO: プロセス終了処理
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}