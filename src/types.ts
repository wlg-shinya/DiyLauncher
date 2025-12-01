// XML全体の構造
export interface XmlStructure {
  config: {
    style?: { __cdata: string };
    layout: {
      __cdata: string;
    };
  };
}

// Configデータの戻り値型
export interface ConfigData {
  html: string;
  css: string;
}

// preloadで橋渡ししているAPI
export interface MyAPI {
  loadConfig: () => Promise<ConfigData>;
  runCommand: (command: string) => Promise<void>;
}
