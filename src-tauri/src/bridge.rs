use tauri::{AppHandle, State};
use crate::{command, config};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
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
    app: AppHandle,
    process_state: State<'_, command::ProcessState>,
    command: String,
    log_id: Option<String>,
    log_file: Option<String>,
    log_mode: Option<String>,
    detach: Option<bool>,
    cmd_pid: Option<String>,
) -> Result<(), String> {
    command::run_command_with_log(
        app,
        process_state,
        command,
        log_id,
        log_file,
        log_mode,
        detach.unwrap_or(false),
        cmd_pid,
    )
    .await
}

#[tauri::command]
pub async fn get_command_output(command: String) -> Result<String, String> {
    command::get_command_output(command).await
}

#[tauri::command]
pub async fn kill_process(
    process_state: State<'_, command::ProcessState>,
    cmd_pid: String,
) -> Result<(), String> {
    command::kill_process(process_state, cmd_pid).await
}
