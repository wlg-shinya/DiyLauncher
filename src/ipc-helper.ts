import { ipcMain, ipcRenderer, IpcMainInvokeEvent } from "electron";
import { IpcChannels } from "./types.js";

export const handleIpc = <K extends keyof IpcChannels>(
  channel: K,
  listener: (event: IpcMainInvokeEvent, ...args: Parameters<IpcChannels[K]>) => Promise<ReturnType<IpcChannels[K]>> | ReturnType<IpcChannels[K]>
) => {
  if (ipcMain) {
    ipcMain.handle(channel, listener);
  }
};

export const invokeIpc = <K extends keyof IpcChannels>(channel: K, ...args: Parameters<IpcChannels[K]>): Promise<ReturnType<IpcChannels[K]>> => {
  if (ipcRenderer) {
    return ipcRenderer.invoke(channel, ...args);
  }
  return Promise.reject(new Error("ipcRenderer not found"));
};
