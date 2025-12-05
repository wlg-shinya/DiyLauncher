import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { spawn } from "node:child_process";
import iconv from "iconv-lite";
import { FILE_PATH } from "./file_paths.js";
import { ensureConfigExists, readConfig, extractConfigCustomSetting, convertToConfigData, setupConfigWatcher } from "./config_helper.js";
import { CommandLogWriter } from "./command_log_writer.js";
import { IpcChannels } from "../types.js";

const handleIpc = <K extends keyof IpcChannels>(
  channel: K,
  listener: (event: IpcMainInvokeEvent, ...args: Parameters<IpcChannels[K]>) => Promise<ReturnType<IpcChannels[K]>> | ReturnType<IpcChannels[K]>
) => {
  ipcMain.handle(channel, listener);
};

const decode = (buf: Buffer): string => {
  // まずUTF-8として変換してみる
  const strUtf8 = buf.toString("utf8");
  // UTF-8として不正なバイト列があった場合、Shift-JIS(CP932)として解釈し直す
  if (strUtf8.includes("\ufffd")) {
    return iconv.decode(buf, "cp932");
  }
  return strUtf8;
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
    icon: FILE_PATH.icon,
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

    const startTime = Date.now();
    const child = spawn(command, { shell: true });
    const logger = new CommandLogWriter(logFile, command);

    const sendOutput = (text: string, type: "stdout" | "stderr" | "exit") => {
      if (logId) {
        event.sender.send("on-command-output", { targetId: logId, text, type });
      }
      logger.write(text, type);
    };
    child.stdout.on("data", (data: Buffer) => sendOutput(decode(data), "stdout"));
    child.stderr.on("data", (data: Buffer) => sendOutput(decode(data), "stderr"));
    child.on("close", (code) => {
      // プロセスにかかった時間を算出
      const endTime = Date.now();
      const diff = endTime - startTime;
      const pad = (n: number, len: number = 2) => n.toString().padStart(len, "0");
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const ms = diff % 1000;
      const durationStr = `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;

      sendOutput(`Process exited with code ${code} (Time: ${durationStr})`, "exit");
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
