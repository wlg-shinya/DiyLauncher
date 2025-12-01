import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { XMLParser } from "fast-xml-parser";
import { FILE_PATH } from "./constants.js";
import { XmlStructure, ConfigData, IpcChannels } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const handleIpc = <K extends keyof IpcChannels>(
  channel: K,
  listener: (event: IpcMainInvokeEvent, ...args: Parameters<IpcChannels[K]>) => Promise<ReturnType<IpcChannels[K]>> | ReturnType<IpcChannels[K]>
) => {
  ipcMain.handle(channel, listener);
};

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, FILE_PATH.preload),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, FILE_PATH.indexHtml));
}

app.whenReady().then(() => {
  createWindow();

  handleIpc("load-config", async (): Promise<ConfigData> => {
    try {
      const xmlPath = path.join(__dirname, FILE_PATH.configXml);
      const xmlData = await fs.readFile(xmlPath, "utf8");

      const parser = new XMLParser({
        ignoreAttributes: false,
        cdataPropName: "__cdata",
      });

      const jsonObj = parser.parse(xmlData) as XmlStructure;

      // データ抽出
      const layoutHtml = jsonObj.config?.layout?.__cdata || "<div>No Layout</div>";
      const styleCss = jsonObj.config?.style?.__cdata || "";

      // セットで返す
      return {
        html: layoutHtml,
        css: styleCss,
      };
    } catch (err) {
      console.error("XML読み込みエラー:", err);
      return { html: `<div>Error: ${err}</div>`, css: "" };
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
