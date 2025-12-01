import { contextBridge, ipcRenderer } from "electron";
import { MyAPI } from "./types.js";

const myApi: MyAPI = {
  loadConfig: () => ipcRenderer.invoke("load-config"),
  runCommand: (command: string) => ipcRenderer.invoke("run-os-command", command),
};

contextBridge.exposeInMainWorld("myAPI", myApi);
