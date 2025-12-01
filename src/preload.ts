import { contextBridge, ipcRenderer } from "electron";

export interface IMyAPI {
  loadConfig: () => Promise<string>;
  runCommand: (command: string) => Promise<void>;
}

contextBridge.exposeInMainWorld("myAPI", {
  loadConfig: () => ipcRenderer.invoke("load-config"),
  runCommand: (command: string) => ipcRenderer.invoke("run-os-command", command),
});
