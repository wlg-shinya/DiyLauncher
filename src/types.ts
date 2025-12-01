// XML全体の構造
export interface XmlStructure {
  config: {
    head?: {
      title?: string;
      width?: number;
      height?: number;
      style?: { __cdata: string };
    };
    body: {
      __cdata: string;
    };
  };
}

// Configデータの戻り値型
export interface ConfigData {
  title: string;
  css: string;
  html: string;
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
