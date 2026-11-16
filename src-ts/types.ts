// config.xmlで使用するカスタム属性名の定義
export const CONFIG_ATTR = {
  COMMAND: "data-command",
  COMMAND_LOG_ID: "data-command-log-id",
  COMMAND_LOG_FILE: "data-command-log-file",
  COMMAND_LOG_MODE: "data-command-log-mode",
  COMMAND_OUTPUT_VAR: "data-command-output-var",
  COMMAND_DETACH: "data-command-detach",
  COMMAND_PID: "data-command-pid",
  VAR: "data-var",
  AUTO_CLICK: "data-auto-click",
} as const;

// config.xmlで使用する変数の定義
export const CONFIG_VAR = {
  PACKAGE_VERSION: "PACKAGE_VERSION",
  NOW: "NOW",
} as const;

// data-command で使用できる独自コマンドの定義
export const COMMAND = {
  KILL: "@KILL:",
} as const;

// Configデータの戻り値型
export interface ConfigData {
  head: string;
  body: string;
  version: string;
}

// コマンド出力データ
export interface CommandOutput {
  targetId: string;
  text: string;
  type: "stdout" | "stderr" | "exit";
  cmdPid?: string | null;
}

// IPC通信チャンネル名と型定義のマップ
export interface IpcChannels {
  "load-config": () => ConfigData;
  "run-command-with-log": (
    command: string,
    logId?: string,
    logFile?: string,
    logMode?: string,
    detach?: boolean,
    cmdPid?: string
  ) => void;
  "get-command-output": (command: string) => string;
  "kill-process": (cmdPid: string) => void;
  "on-command-output": (data: CommandOutput) => void;
  "on-config-updated": (data: ConfigData) => void;
}

// 橋渡しAPI
type ApiMethod<K extends keyof IpcChannels> = (...args: Parameters<IpcChannels[K]>) => Promise<ReturnType<IpcChannels[K]>>;
type ApiListener<K extends keyof IpcChannels> = (callback: (...args: Parameters<IpcChannels[K]>) => void) => void;
export interface BridgeAPI {
  loadConfig: ApiMethod<"load-config">;
  runCommandWithLog: ApiMethod<"run-command-with-log">;
  getCommandOutput: ApiMethod<"get-command-output">;
  killProcess: ApiMethod<"kill-process">;
  onCommandOutput: ApiListener<"on-command-output">;
  onConfigUpdate: ApiListener<"on-config-updated">;
}