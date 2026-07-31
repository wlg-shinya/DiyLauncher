use notify::Watcher;
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tauri::Emitter;

const CONFIG_FILE_NAME: &str = "config.xml";
const ICON_FILE_NAME: &str = "icon.ico";
const PACKAGE_VERSION_TAG: &str = "{{PACKAGE_VERSION}}";

pub struct ParsedConfig {
    pub head: String,
    pub body: String,
    pub width: u64,
    pub height: u64,
    pub title: Option<String>,
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

pub fn parse_config_xml(xml_str: &str, version: &str) -> ParsedConfig {
    let raw_head = extract_tag_content(xml_str, "head");
    let raw_body = extract_tag_content(xml_str, "body");

    // パッケージバージョンタグを実際のバージョン文字列に置換
    let head = raw_head.replace(PACKAGE_VERSION_TAG, version);
    let mut body = raw_body.replace(PACKAGE_VERSION_TAG, version);

    if body.is_empty() {
        body = "<div>No Body</div>".to_string();
    }

    // ウィンドウの幅・高さの取得
    let width = extract_custom_setting(&head, "width", 600);
    let height = extract_custom_setting(&head, "height", 500);

    // ウィンドウタイトルの取得
    let title_str = extract_tag_content(&head, "title");
    let title = if title_str.is_empty() {
        None
    } else {
        // タイトル内のパッケージバージョンタグも置換
        Some(title_str.replace(PACKAGE_VERSION_TAG, version))
    };

    ParsedConfig { head, body, width, height, title }
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

pub fn apply_window_settings(app: &tauri::AppHandle, parsed: &ParsedConfig) {
    if let Some(window) = app.get_webview_window("main") {
        // サイズの適用
        let size = tauri::Size::Logical(tauri::LogicalSize { 
            width: parsed.width as f64, 
            height: parsed.height as f64 
        });
        let _ = window.set_size(size);

        // タイトルの適用
        if let Some(ref t) = parsed.title {
            let _ = window.set_title(t);
        }
    }
}

pub fn setup_config_watcher(app: AppHandle) {
    let config_path = get_app_path(CONFIG_FILE_NAME);

    std::thread::spawn(move || {
        let (tx, rx) = channel();

        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[Error] ファイル監視の開始に失敗: {}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(&config_path, notify::RecursiveMode::NonRecursive) {
            eprintln!("[Error] {} の監視に失敗: {}", CONFIG_FILE_NAME, e);
            return;
        }

        let mut last_updated = Instant::now();

        for res in rx {
            match res {
                Ok(event) => {
                    if matches!(event.kind, notify::EventKind::Modify(_)) {
                        if last_updated.elapsed() < Duration::from_millis(200) {
                            continue;
                        }
                        last_updated = Instant::now();

                        std::thread::sleep(Duration::from_millis(100)); // エディタの書き込み完了を確実に待つためわずかにスリープ

                        println!("[{}] が更新されました。ホットリロードを実行します。", CONFIG_FILE_NAME);

                        if let Ok(xml_str) = read_config_xml() {
                            let version = app.package_info().version.to_string();
                            let parsed = parse_config_xml(&xml_str, &version);

                            // ウィンドウサイズとタイトルの再適用
                            apply_window_settings(&app, &parsed);

                            // フロントエンドへ更新データを送信
                            let config_data = crate::bridge::ConfigData {
                                head: parsed.head,
                                body: parsed.body,
                                version,
                            };
                            let _ = app.emit("on-config-updated", config_data);
                        }
                    }
                }
                Err(e) => eprintln!("[Error] ファイル監視エラー: {}", e),
            }
        }
    });
}

fn get_base_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    } else {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."))
    }
}

fn get_app_path(file_name: &str) -> PathBuf {
    get_base_dir().join(file_name)
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
