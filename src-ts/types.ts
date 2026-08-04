// XML全体の構造
export interface XmlStructure {
  config: {
    head: { __cdata: string };
    body: { __cdata: string };
  };
}

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
}

// IPC通信チャンネル名と型定義のマップ
export interface IpcChannels {
  "load-config": () => ConfigData;
  "run-command-with-log": (command: string, logId?: string, logFile?: string, logMode?: string, detach?: boolean) => void;
  "get-command-output": (command: string) => string;
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
  onCommandOutput: ApiListener<"on-command-output">;
  onConfigUpdate: ApiListener<"on-config-updated">;
}