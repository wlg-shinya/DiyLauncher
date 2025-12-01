import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("myAPI", {
  loadConfig: () => ipcRenderer.invoke("load-config"),
  runCommand: (command) => ipcRenderer.invoke("run-os-command", command),
});
