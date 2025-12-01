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

async function readConfigXml(): Promise<XmlStructure | null> {
  try {
    const xmlPath = path.join(__dirname, FILE_PATH.configXml);
    const xmlData = await fs.readFile(xmlPath, "utf8");

    const parser = new XMLParser({
      ignoreAttributes: false,
      cdataPropName: "__cdata",
    });

    return parser.parse(xmlData) as XmlStructure;
  } catch (err) {
    console.error("Config読み込み失敗:", err);
    return null;
  }
}

const handleIpc = <K extends keyof IpcChannels>(
  channel: K,
  listener: (event: IpcMainInvokeEvent, ...args: Parameters<IpcChannels[K]>) => Promise<ReturnType<IpcChannels[K]>> | ReturnType<IpcChannels[K]>
) => {
  ipcMain.handle(channel, listener);
};

async function createWindow() {
  const xmlObj = await readConfigXml();
  const config = xmlObj?.config;
  const width = config?.width ? Number(config.width) : 600;
  const height = config?.height ? Number(config.height) : 500;
  const win = new BrowserWindow({
    width: width,
    height: height,
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

  handleIpc("load-config", async () => {
    try {
      const xmlObj = await readConfigXml();
      const config = xmlObj?.config;
      const layoutHtml = config?.layout?.__cdata || "<div>No Layout</div>";
      const styleCss = config?.style?.__cdata || "";
      const appTitle = config?.title || app.getName();
      return {
        title: appTitle,
        html: layoutHtml,
        css: styleCss,
      };
    } catch (err) {
      return { title: app.getName(), html: `<div>Error: ${err}</div>`, css: "" };
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
