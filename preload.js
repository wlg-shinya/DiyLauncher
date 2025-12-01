import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("myAPI", {
  runCommand: (command) => ipcRenderer.invoke("run-os-command", command),
});
