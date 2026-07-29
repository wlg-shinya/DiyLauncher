import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BridgeAPI, ConfigData, CommandOutput } from "./types";

export function setupTauriBridge(): void {
  const bridgeAPI: BridgeAPI = {
    loadConfig: () => invoke("load_config"),
    runCommandWithLog: (command, targetId, logFile, logMode) =>
      invoke("run_command_with_log", { command, targetId, logFile, logMode }),
    getCommandOutput: (command) => invoke("get_command_output", { command }),
    onCommandOutput: (callback) => {
      listen<CommandOutput>("on-command-output", (event) => callback(event.payload));
    },
    onConfigUpdate: (callback) => {
      listen<ConfigData>("on-config-updated", (event) => callback(event.payload));
    },
  };

  (window as any).bridgeAPI = bridgeAPI;
}