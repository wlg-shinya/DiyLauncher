import { contextBridge } from "electron";
import { MyAPI } from "./types.js";
import { invokeIpc } from "./ipc-helper.js";

const myApi: MyAPI = {
  loadConfig: () => invokeIpc("load-config"),
  runCommand: (command: string) => invokeIpc("run-os-command", command),
};

contextBridge.exposeInMainWorld("myAPI", myApi);
