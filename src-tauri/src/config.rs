use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const CONFIG_FILE_NAME: &str = "config.xml";
const ICON_FILE_NAME: &str = "icon.ico";

pub fn get_base_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    } else {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."))
    }
}

pub fn get_app_path(file_name: &str) -> PathBuf {
    get_base_dir().join(file_name)
}

pub fn ensure_config_exists(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_name = &app.package_info().name;

    let config_path = get_app_path(CONFIG_FILE_NAME);
    let icon_path = get_app_path(ICON_FILE_NAME);

    if !config_path.exists() {
        let default_config = include_str!("../resources/config.default.xml");
        fs::write(&config_path, default_config)?;
        println!("[{}] {} を初期生成しました", app_name, CONFIG_FILE_NAME);
    }

    if !icon_path.exists() {
        let default_icon = include_bytes!("../resources/icon.default.ico");
        fs::write(&icon_path, default_icon)?;
        println!("[{}] {} を初期生成しました", app_name, ICON_FILE_NAME);
    }

    Ok(())
}

pub fn apply_window_icon(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let icon_path = get_app_path(ICON_FILE_NAME);
    if icon_path.exists() {
        if let Ok(image) = tauri::image::Image::from_path(&icon_path) {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(image);
            }
        }
    }
    Ok(())
}

pub fn read_config_xml() -> Result<String, String> {
    let path = get_app_path(CONFIG_FILE_NAME);
    fs::read_to_string(&path)
        .map_err(|e| format!("{} の読み込みに失敗しました: {}", CONFIG_FILE_NAME, e))
}