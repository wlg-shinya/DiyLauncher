import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { XMLParser } from "fast-xml-parser";
import { FILE_PATH } from "./constants.js";
import { XmlStructure } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  ipcMain.handle("load-config", async (): Promise<string> => {
    try {
      const xmlPath = path.join(__dirname, FILE_PATH.configXml);
      const xmlData = await fs.readFile(xmlPath, "utf8");

      const parser = new XMLParser({
        ignoreAttributes: false,
        cdataPropName: "__cdata",
      });

      const jsonObj = parser.parse(xmlData) as XmlStructure;
      if (jsonObj.config && jsonObj.config.layout && jsonObj.config.layout.__cdata) {
        return jsonObj.config.layout.__cdata;
      }
      return "<div>設定読み込みエラー: レイアウトが見つかりません</div>";
    } catch (err) {
      console.error("XML読み込みエラー:", err);
      return `<div>エラーが発生しました: ${err}</div>`;
    }
  });

  ipcMain.handle("run-os-command", async (_event, command: string) => {
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
