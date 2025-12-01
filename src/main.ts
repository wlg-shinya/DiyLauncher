import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { XMLParser } from "fast-xml-parser";

// 型定義: ボタンのデータ構造
interface LauncherButton {
  label: string;
  command: string;
}

// 型定義: XML全体の構造
interface XmlStructure {
  launcher: {
    button:
      | {
          label: string | { __cdata: string };
          command: string;
        }
      | Array<{
          label: string | { __cdata: string };
          command: string;
        }>;
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: {
      // distフォルダに出力されるので、同じ階層のpreload.jsを読む
      preload: path.join(__dirname, "preload.js"),
      sandbox: false, // ユーザー設定によりfalse
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // distフォルダから見ると index.html は一つ上の階層にある
  win.loadFile(path.join(__dirname, "../index.html"));
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("load-config", async (): Promise<LauncherButton[]> => {
    try {
      // dist/main.js から見てプロジェクトルートの config.xml を探す
      const xmlPath = path.join(__dirname, "../config.xml");
      const xmlData = await fs.readFile(xmlPath, "utf8");

      const parser = new XMLParser({
        ignoreAttributes: false,
        cdataPropName: "__cdata",
      });

      const jsonObj = parser.parse(xmlData) as XmlStructure;

      let buttons = jsonObj.launcher.button;
      if (!Array.isArray(buttons)) {
        buttons = [buttons];
      }

      // 整形して返す
      return buttons.map((btn) => {
        const labelText = typeof btn.label === "object" && btn.label.__cdata ? btn.label.__cdata : (btn.label as string);

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
