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
}

// IPC通信チャンネル名と型定義のマップ
export interface IpcChannels {
  "load-config": () => ConfigData;
  "run-os-command": (command: string) => void;
}

// preloadで橋渡ししているAPI
type ApiMethod<K extends keyof IpcChannels> = (...args: Parameters<IpcChannels[K]>) => Promise<ReturnType<IpcChannels[K]>>;
export interface MyAPI {
  loadConfig: ApiMethod<"load-config">;
  runCommand: ApiMethod<"run-os-command">;
}
