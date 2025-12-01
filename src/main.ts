import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { XMLParser } from "fast-xml-parser";
import { FILE_PATH } from "./constants.js";
import { XmlStructure, IpcChannels } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const injectCdata = (xmlString: string, tag: string): string => {
  // <tag> と </tag> の間のあらゆる文字を取得し、CDATAで囲んで置換
  const regex = new RegExp(`(<${tag}>)([\\s\\S]*?)(<\/${tag}>)`, "gi");
  return xmlString.replace(regex, (match, openTag, content, closeTag) => {
    // 既にCDATAがある場合は二重にならないように配慮（念のため）
    if (content.trim().startsWith("<![CDATA[")) {
      return match;
    }
    return `${openTag}<![CDATA[${content}]]>${closeTag}`;
  });
};

async function readConfigXml(): Promise<XmlStructure | null> {
  try {
    const xmlPath = path.join(__dirname, FILE_PATH.configXml);
    let xmlData = await fs.readFile(xmlPath, "utf8");

    // 外部で設定しているHTMLがそのまま読み込まれるようCDATA付与
    xmlData = injectCdata(xmlData, "style");
    xmlData = injectCdata(xmlData, "body");

    // XMLパース
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
  const configHead = xmlObj?.config.head;
  const width = configHead?.width ? Number(configHead.width) : 600;
  const height = configHead?.height ? Number(configHead.height) : 500;
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
      const appTitle = config?.head?.title || app.getName();
      const styleCss = config?.head?.style?.__cdata || "";
      const layoutHtml = config?.body?.__cdata || "<div>No Layout</div>";
      return {
        title: appTitle,
        css: styleCss,
        html: layoutHtml,
      };
    } catch (err) {
      return { title: app.getName(), css: "", html: `<div>Error: ${err}</div>` };
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
