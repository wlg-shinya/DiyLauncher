import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { exec } from "node:child_process";
import { FILE_PATH } from "./constants.js";
import { IpcChannels } from "./types.js";
import { ensureConfigExists, readConfig, extractConfigCustomSetting } from "./config_helper.js";

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

  win.loadFile(FILE_PATH.indexHtml);
}

app.whenReady().then(async () => {
  await ensureConfigExists();
  await createWindow();

  handleIpc("load-config", async () => {
    try {
      const xmlObj = await readConfig();
      const headHtml = xmlObj?.config?.head?.__cdata || "";
      const bodyHtml = xmlObj?.config?.body?.__cdata || "<div>No Body</div>";
      return {
        head: headHtml,
        body: bodyHtml,
      };
    } catch (err) {
      return { head: "", body: `<div>Error: ${err}</div>` };
    }
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
