use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const CONFIG_FILE_NAME: &str = "config.xml";
const ICON_FILE_NAME: &str = "icon.ico";

pub struct ParsedConfig {
    pub head: String,
    pub body: String,
    pub width: u64,
    pub height: u64,
}

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

pub fn read_config_xml() -> Result<String, String> {
    let path = get_app_path(CONFIG_FILE_NAME);
    fs::read_to_string(&path)
        .map_err(|e| format!("{} の読み込みに失敗しました: {}", CONFIG_FILE_NAME, e))
}

pub fn parse_config_xml(xml_str: &str) -> ParsedConfig {
    let head = extract_tag_content(xml_str, "head");
    let mut body = extract_tag_content(xml_str, "body");
    if body.is_empty() {
        body = "<div>No Body</div>".to_string();
    }

    let width = extract_custom_setting(&head, "width", 800);
    let height = extract_custom_setting(&head, "height", 600);

    ParsedConfig { head, body, width, height }
}

fn extract_tag_content(xml: &str, tag: &str) -> String {
    let start_tag = format!("<{}>", tag);
    let end_tag = format!("</{}>", tag);

    if let (Some(start_idx), Some(end_idx)) = (xml.find(&start_tag), xml.find(&end_tag)) {
        let content_start = start_idx + start_tag.len();
        if content_start <= end_idx {
            let content = &xml[content_start..end_idx];
            // 元のXMLに CDATA が含まれている場合は除去する
            let clean_content = content.replace("<![CDATA[", "").replace("]]>", "");
            return clean_content.trim().to_string();
        }
    }
    String::new()
}

fn extract_custom_setting(html: &str, tag: &str, default: u64) -> u64 {
    let start_tag = format!("<{}>", tag);
    let end_tag = format!("</{}>", tag);

    if let (Some(start_idx), Some(end_idx)) = (html.find(&start_tag), html.find(&end_tag)) {
        let content_start = start_idx + start_tag.len();
        if content_start <= end_idx {
            let content = html[content_start..end_idx].trim();
            if let Ok(val) = content.parse::<u64>() {
                return val;
            }
        }
    }
    default
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

pub fn apply_window_size(app: &tauri::AppHandle, width: f64, height: f64) {
    if let Some(window) = app.get_webview_window("main") {
        let size = tauri::Size::Logical(tauri::LogicalSize { width, height });
        let _ = window.set_size(size);
    }
}