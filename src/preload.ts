import { contextBridge, ipcRenderer } from "electron";
import { MyAPI, IpcChannels, ConfigData, CommandOutput } from "./types.js";

const invoke = <K extends keyof IpcChannels>(channel: K, ...args: Parameters<IpcChannels[K]>): Promise<ReturnType<IpcChannels[K]>> => {
  return ipcRenderer.invoke(channel, ...args);
};

const myApi: MyAPI = {
  loadConfig: () => invoke("load-config"),
  runCommandWithLog: (command, targetId, logFile) => invoke("run-command-with-log", command, targetId, logFile),
  getCommandOutput: (command) => invoke("get-command-output", command),
  onCommandOutput: (callback) => {
    ipcRenderer.on("on-command-output", (_event, data: CommandOutput) => callback(data));
  },
  onConfigUpdate: (callback) => {
    ipcRenderer.on("on-config-updated", (_event, data: ConfigData) => callback(data));
  },
};

contextBridge.exposeInMainWorld("myAPI", myApi);
