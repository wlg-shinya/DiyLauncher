use tauri::AppHandle;
use crate::config;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ConfigData {
    pub head: String,
    pub body: String,
    pub version: String,
}

#[tauri::command]
pub async fn load_config(app: AppHandle) -> Result<ConfigData, String> {
    let version = app.package_info().version.to_string();
    let xml_str = config::read_config_xml()?;
    let parsed = config::parse_config_xml(&xml_str, &version);
    Ok(ConfigData {
        head: parsed.head,
        body: parsed.body,
        version,
    })
}

#[tauri::command]
pub async fn run_command_with_log(
    _app: AppHandle,
    _command: String,
    _log_id: Option<String>,
    _log_file: Option<String>,
    _log_mode: Option<String>,
) -> Result<(), String> {
    // TODO: Electron の spawn / activeProcesses 管理の移植
    Ok(())
}

#[tauri::command]
pub async fn get_command_output(_command: String) -> Result<String, String> {
    // TODO: Electron の exec の移植
    Ok(String::new())
}
