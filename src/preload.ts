import { contextBridge, ipcRenderer } from "electron";
import { MyAPI, IpcChannels, ConfigData, CommandOutput } from "./types.js";

const invoke = <K extends keyof IpcChannels>(channel: K, ...args: Parameters<IpcChannels[K]>): Promise<ReturnType<IpcChannels[K]>> => {
  return ipcRenderer.invoke(channel, ...args);
};

const myApi: MyAPI = {
  loadConfig: () => invoke("load-config"),
  runCommand: (command, targetId, logFile) => invoke("run-os-command", command, targetId, logFile),
  onCommandOutput: (callback) => {
    ipcRenderer.on("on-command-output", (_event, data: CommandOutput) => callback(data));
  },
  onConfigUpdate: (callback) => {
    ipcRenderer.on("on-config-updated", (_event, data: ConfigData) => callback(data));
  },
};

contextBridge.exposeInMainWorld("myAPI", myApi);
