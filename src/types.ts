// XML全体の構造
export interface XmlStructure {
  config: {
    layout: {
      __cdata: string;
    };
  };
}

// preloadで橋渡ししているAPI
export interface MyAPI {
  loadConfig: () => Promise<string>;
  runCommand: (command: string) => Promise<void>;
}
