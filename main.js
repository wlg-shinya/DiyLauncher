import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { XMLParser } from "fast-xml-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("load-config", async () => {
    try {
      const xmlPath = path.join(__dirname, "config.xml");
      const xmlData = await fs.readFile(xmlPath, "utf8");

      const parser = new XMLParser({
        ignoreAttributes: false,
        cdataPropName: "__cdata",
      });

      const jsonObj = parser.parse(xmlData);

      let buttons = jsonObj.launcher.button;
      if (!Array.isArray(buttons)) {
        buttons = [buttons];
      }

      return buttons.map((btn) => {
        const labelText = btn.label && btn.label.__cdata ? btn.label.__cdata : btn.label;
        return {
          label: labelText,
          command: btn.command,
        };
      });
    } catch (err) {
      console.error("XML読み込みエラー:", err);
      return [];
    }
  });

  ipcMain.handle("run-os-command", async (event, command) => {
    console.log(`実行: ${command}`);
    return new Promise((resolve) => {
      exec(command, (error, stdout) => {
        if (error) resolve(`エラー: ${error.message}`);
        else resolve(`成功`);
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
