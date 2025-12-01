import { contextBridge, ipcRenderer } from "electron";

// 画面側で使う型を定義
interface LauncherButton {
  label: string;
  command: string;
}

export interface IMyAPI {
  loadConfig: () => Promise<LauncherButton[]>;
  runCommand: (command: string) => Promise<void>;
}

contextBridge.exposeInMainWorld("myAPI", {
  loadConfig: () => ipcRenderer.invoke("load-config"),
  runCommand: (command: string) => ipcRenderer.invoke("run-os-command", command),
});
