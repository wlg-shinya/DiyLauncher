import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { spawn } from "node:child_process";
import { FILE_PATH } from "./constants.js";
import { IpcChannels } from "./types.js";
import { ensureConfigExists, readConfig, extractConfigCustomSetting, convertToConfigData, setupConfigWatcher } from "./config_helper.js";
import { CommandLogWriter } from "./command_log_writer.js";

const handleIpc = <K extends keyof IpcChannels>(
  channel: K,
  listener: (event: IpcMainInvokeEvent, ...args: Parameters<IpcChannels[K]>) => Promise<ReturnType<IpcChannels[K]>> | ReturnType<IpcChannels[K]>
) => {
  ipcMain.handle(channel, listener);
};

async function createWindow() {
  const xmlObj = await readConfig();
  const headHtml = xmlObj?.config?.head?.__cdata || "";

  // <width>, <height>を抽出
  const width = extractConfigCustomSetting(headHtml, "width", 600);
  const height = extractConfigCustomSetting(headHtml, "height", 500);

  const win = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: FILE_PATH.preload,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    win.setMenu(null);
  }

  // 設定ファイルの監視によるホットリロード
  setupConfigWatcher(win);

  win.loadFile(FILE_PATH.indexHtml);
}

app.whenReady().then(async () => {
  await ensureConfigExists();
  await createWindow();

  handleIpc("load-config", async () => {
    const xmlObj = await readConfig();
    return convertToConfigData(xmlObj);
  });

  handleIpc("run-os-command", async (event, command, logId, logFile) => {
    console.log(`実行コマンド: ${command}`);

    // 文字コード設定 (Windows用)
    let execCommand = command;
    if (process.platform === "win32") {
      execCommand = `chcp 65001 > nul && ${command}`;
    }

    const child = spawn(execCommand, { shell: true });
    const logger = new CommandLogWriter(logFile, command);

    // 出力処理共通化
    const sendOutput = (text: string, type: "stdout" | "stderr" | "exit") => {
      if (logId) {
        event.sender.send("on-command-output", { targetId: logId, text, type });
      }
      logger.write(text, type);
    };

    // 標準出力
    child.stdout.on("data", (data: Buffer) => {
      const str = data.toString();
      sendOutput(str, "stdout");
    });

    // エラー出力
    child.stderr.on("data", (data: Buffer) => {
      const str = data.toString();
      sendOutput(str, "stderr");
    });

    // 終了時
    child.on("close", (code) => {
      sendOutput(`Process exited with code ${code}`, "exit");
      logger.close();
    });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
