use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

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

pub fn ensure_config_exists() -> Result<(), Box<dyn std::error::Error>> {
    let base_dir = get_base_dir();
    let config_path = base_dir.join("config.xml");
    let icon_path = base_dir.join("icon.ico");

    if !config_path.exists() {
        let default_config = include_str!("../resources/config.default.xml");
        fs::write(&config_path, default_config)?;
        println!("[DiyLauncher] config.xml を初期生成しました");
    }

    if !icon_path.exists() {
        let default_icon = include_bytes!("../resources/icon.default.ico");
        fs::write(&icon_path, default_icon)?;
        println!("[DiyLauncher] icon.ico を初期生成しました");
    }

    Ok(())
}

pub fn apply_window_icon(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let icon_path = get_base_dir().join("icon.ico");
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
    let path = get_base_dir().join("config.xml");
    fs::read_to_string(path).map_err(|e| format!("config.xml の読み込みに失敗しました: {}", e))
}