import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { spawn } from "node:child_process";
import fsCallback from "node:fs";
import path from "node:path";
import iconv from "iconv-lite";
import { FILE_PATH } from "./constants.js";
import { IpcChannels } from "./types.js";
import {
  ensureConfigExists,
  readConfig,
  extractConfigCustomSetting,
  getConfigPath,
  convertToConfigData,
  setupConfigWatcher,
} from "./config_helper.js";

const handleIpc = <K extends keyof IpcChannels>(
  channel: K,
  listener: (event: IpcMainInvokeEvent, ...args: Parameters<IpcChannels[K]>) => Promise<ReturnType<IpcChannels[K]>> | ReturnType<IpcChannels[K]>
) => {
  ipcMain.handle(channel, listener);
};

const getLogPath = (filename: string): string => {
  // config.xml と同じ階層にある logs フォルダを使用
  const baseDir = path.dirname(getConfigPath());
  const logsDir = path.join(baseDir, "logs");

  if (!fsCallback.existsSync(logsDir)) {
    fsCallback.mkdirSync(logsDir);
  }
  return path.join(logsDir, filename);
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

  handleIpc("run-os-command", async (event, command, targetId, logFile) => {
    console.log(`実行: ${command}`);

    // shell: true で実行 (dirコマンド等が動くように)
    const child = spawn(command, { shell: true });

    // ログファイルへの書き込みストリーム準備
    let logStream: fsCallback.WriteStream | null = null;
    if (logFile) {
      try {
        const filePath = getLogPath(logFile);
        logStream = fsCallback.createWriteStream(filePath, { flags: "a" });
        const time = new Date().toLocaleString();
        logStream.write(`\n--- [${time}] Command: ${command} ---\n`);
      } catch (err) {
        console.error("ログファイル作成失敗:", err);
      }
    }

    // 出力処理共通化
    const sendOutput = (text: string, type: "stdout" | "stderr" | "exit") => {
      console.log(`[Main] データ送信: ${type} -> ${text.trim().substring(0, 20)}...`); // ★ログ2

      // 画面へ送信 (UTF-8化済み)
      if (targetId) {
        event.sender.send("on-command-output", { targetId, text, type });
      }

      // ログファイルへ保存 (Node.jsが自動でUTF-8で書き込む)
      if (logStream) {
        if (type !== "exit") logStream.write(text);
        else logStream.write(`\n[Exited]\n`);
      }
    };

    // 標準出力 (文字化け対策込み)
    child.stdout.on("data", (data: Buffer) => {
      // WindowsならCP932(Shift-JIS)、それ以外はUTF-8としてデコード
      const encoding = process.platform === "win32" ? "cp932" : "utf8";
      const str = iconv.decode(data, encoding);
      sendOutput(str, "stdout");
    });

    // エラー出力
    child.stderr.on("data", (data: Buffer) => {
      const encoding = process.platform === "win32" ? "cp932" : "utf8";
      const str = iconv.decode(data, encoding);
      sendOutput(str, "stderr");
    });

    // 終了時
    child.on("close", (code) => {
      sendOutput(`Process exited with code ${code}`, "exit");
      if (logStream) logStream.end();
    });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
