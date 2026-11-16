use notify::Watcher;
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

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
    let raw_head = extract_tag_content(xml_str, "head", true);
    let raw_body = extract_tag_content(xml_str, "body", true);

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
    let title_str = extract_tag_content(&head, "title", false);
    let title = if title_str.is_empty() {
        None
    } else {
        // タイトル内のパッケージバージョンタグも置換
        Some(title_str.replace(PACKAGE_VERSION_TAG, version))
    };

    ParsedConfig {
        head,
        body,
        width,
        height,
        title,
    }
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
            height: parsed.height as f64,
        });
        let _ = window.set_size(size);

        // タイトルの適用
        if let Some(ref t) = parsed.title {
            let _ = window.set_title(t);
        }
    }
}

pub fn setup_config_watcher(app: AppHandle) {
    let watch_dir = get_base_dir();

    std::thread::spawn(move || {
        let (tx, rx) = channel();

        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[Error] ファイル監視の開始に失敗: {}", e);
                return;
            }
        };

        // エディタのアトミック保存（一時ファイルからのリネーム置換）でも監視が切れないよう親ディレクトリを監視する
        if let Err(e) = watcher.watch(&watch_dir, notify::RecursiveMode::NonRecursive) {
            eprintln!("[Error] {} の監視に失敗: {}", CONFIG_FILE_NAME, e);
            return;
        }

        // 初回イベントが即座に発火しても弾かれないよう、過去の時刻で初期化
        let mut last_updated = Instant::now() - Duration::from_secs(1);

        for res in rx {
            match res {
                Ok(event) => {
                    let is_relevant_kind = matches!(
                        event.kind,
                        notify::EventKind::Modify(_) | notify::EventKind::Create(_)
                    );
                    if !is_relevant_kind {
                        continue;
                    }

                    // イベント対象パスに config.xml が含まれているか確認
                    let is_config_file = event.paths.iter().any(|p| {
                        p.file_name().and_then(|name| name.to_str()) == Some(CONFIG_FILE_NAME)
                    });
                    if !is_config_file {
                        continue;
                    }

                    if last_updated.elapsed() < Duration::from_millis(200) {
                        continue;
                    }
                    last_updated = Instant::now();

                    // エディタの書き込み・リネーム完了を確実に待つためわずかにスリープ
                    std::thread::sleep(Duration::from_millis(100));

                    // 保存直後の瞬間的なファイルロックに備えて数回リトライして読み込む
                    let mut xml_content = None;
                    for _ in 0..3 {
                        if let Ok(content) = read_config_xml() {
                            if !content.trim().is_empty() {
                                xml_content = Some(content);
                                break;
                            }
                        }
                        std::thread::sleep(Duration::from_millis(50));
                    }

                    if let Some(xml_str) = xml_content {
                        println!(
                            "[{}] が更新されました。ホットリロードを実行します。",
                            CONFIG_FILE_NAME
                        );

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

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() {
        return Some(0);
    }
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn find_open_tag_end(xml: &str, tag: &str) -> Option<usize> {
    let bytes = xml.as_bytes();
    let tag_bytes = tag.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        // コメントブロック <!-- ... --> をスキップ（バイト列で比較しUTF-8境界パニックを防ぐ）
        if bytes[i..].starts_with(b"<!--") {
            if let Some(end_comment) = find_subsequence(&bytes[i + 4..], b"-->") {
                i += 4 + end_comment + 3;
                continue;
            } else {
                return None;
            }
        }

        // 開始タグの候補 "<{tag}" をチェック
        if bytes[i] == b'<' && i + 1 + tag_bytes.len() < len {
            let after_lt = i + 1;
            if &bytes[after_lt..after_lt + tag_bytes.len()] == tag_bytes {
                let after_name = after_lt + tag_bytes.len();
                let next_byte = bytes[after_name];

                // タグ名の直後が '>' または空白文字（属性付きタグ）である場合のみ一致とみなす
                if next_byte == b'>' || next_byte.is_ascii_whitespace() {
                    if let Some(rel_gt) = bytes[after_name..].iter().position(|&b| b == b'>') {
                        let gt_idx = after_name + rel_gt;
                        // 自己終了タグ (<body />) は除外する
                        let attr_bytes = &bytes[after_name..gt_idx];
                        let last_non_ws = attr_bytes.iter().rev().find(|b| !b.is_ascii_whitespace());
                        if last_non_ws != Some(&b'/') {
                            return Some(gt_idx + 1);
                        }
                    }
                }
            }
        }

        i += 1;
    }

    None
}

fn find_close_tag_start(xml: &str, tag: &str, find_last: bool) -> Option<usize> {
    let bytes = xml.as_bytes();
    let tag_bytes = tag.as_bytes();
    let len = bytes.len();
    let mut i = 0;
    let mut found = None;

    while i < len {
        // コメントブロック <!-- ... --> をスキップ（バイト列で比較しUTF-8境界パニックを防ぐ）
        if bytes[i..].starts_with(b"<!--") {
            if let Some(end_comment) = find_subsequence(&bytes[i + 4..], b"-->") {
                i += 4 + end_comment + 3;
                continue;
            } else {
                break;
            }
        }

        // 終了タグの候補 "</{tag}" をチェック
        if bytes[i..].starts_with(b"</") && i + 2 + tag_bytes.len() < len {
            let after_slash = i + 2;
            if &bytes[after_slash..after_slash + tag_bytes.len()] == tag_bytes {
                let mut cursor = after_slash + tag_bytes.len();
                // "</body >" のように閉じ括弧前に空白がある場合も許容
                while cursor < len && bytes[cursor].is_ascii_whitespace() {
                    cursor += 1;
                }
                if cursor < len && bytes[cursor] == b'>' {
                    if find_last {
                        found = Some(i);
                        i = cursor + 1;
                        continue;
                    } else {
                        return Some(i);
                    }
                }
            }
        }

        i += 1;
    }

    found
}

fn unwrap_cdata(content: &str) -> &str {
    let trimmed = content.trim();
    if let Some(inner) = trimmed
        .strip_prefix("<![CDATA[")
        .and_then(|s| s.strip_suffix("]]>"))
    {
        inner.trim()
    } else {
        trimmed
    }
}

fn extract_tag_content(xml: &str, tag: &str, find_last_end: bool) -> String {
    if let Some(content_start) = find_open_tag_end(xml, tag) {
        if let Some(rel_end_idx) = find_close_tag_start(&xml[content_start..], tag, find_last_end) {
            let content = &xml[content_start..content_start + rel_end_idx];
            return unwrap_cdata(content).to_string();
        }
    }
    String::new()
}

fn extract_custom_setting(html: &str, tag: &str, default: u64) -> u64 {
    let content = extract_tag_content(html, tag, false);
    if let Ok(val) = content.parse::<u64>() {
        return val;
    }
    default
}