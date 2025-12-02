import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { exec } from "node:child_process";
import fsCallback from "node:fs";
import { FILE_PATH } from "./constants.js";
import { IpcChannels } from "./types.js";
import { ensureConfigExists, readConfig, extractConfigCustomSetting, getConfigPath, convertToConfigData } from "./config_helper.js";

const handleIpc = <K extends keyof IpcChannels>(
  channel: K,
  listener: (event: IpcMainInvokeEvent, ...args: Parameters<IpcChannels[K]>) => Promise<ReturnType<IpcChannels[K]>> | ReturnType<IpcChannels[K]>
) => {
  ipcMain.handle(channel, listener);
};

function setupConfigWatcher(win: BrowserWindow) {
  const configPath = getConfigPath();
  let fsWait = false;

  fsCallback.watch(configPath, async (event) => {
    if (fsWait) return;

    if (event === "change") {
      fsWait = true;
      // 連続発火防止 (デバウンス処理)
      setTimeout(async () => {
        fsWait = false;
        console.log("Config updated detected.");

        // 設定を読み直す
        const xmlObj = await readConfig();

        // ウィンドウサイズの更新処理
        const headHtml = xmlObj?.config?.head?.__cdata || "";
        const newWidth = extractConfigCustomSetting(headHtml, "width", 600);
        const newHeight = extractConfigCustomSetting(headHtml, "height", 500);

        // 現在のサイズと違えば変更する (アニメーションOFFで即時反映)
        const [currentW, currentH] = win.getSize();
        if (currentW !== newWidth || currentH !== newHeight) {
          win.setSize(newWidth, newHeight, false);
        }

        // 画面に送信
        const configData = convertToConfigData(xmlObj);
        win.webContents.send("on-config-updated", configData);
      }, 100);
    }
  });
}

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

  handleIpc("run-os-command", async (_event, command: string) => {
    console.log(`実行: ${command}`);
    return new Promise<void>((resolve) => {
      exec(command, (error) => {
        if (error) console.error(error);
        resolve();
      });
    });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
