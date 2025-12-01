import { contextBridge, ipcRenderer } from "electron";
import { MyAPI, IpcChannels } from "./types.js";

const invoke = <K extends keyof IpcChannels>(channel: K, ...args: Parameters<IpcChannels[K]>): Promise<ReturnType<IpcChannels[K]>> => {
  return ipcRenderer.invoke(channel, ...args);
};

const myApi: MyAPI = {
  loadConfig: () => invoke("load-config"),
  runCommand: (command: string) => invoke("run-os-command", command),
};

contextBridge.exposeInMainWorld("myAPI", myApi);
