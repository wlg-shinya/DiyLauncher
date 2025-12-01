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

const getConfigPath = () => {
  if (app.isPackaged) {
    // 本番: exeと同じ階層にある resources フォルダの中を見る
    return path.join(process.resourcesPath, "config.xml");
  } else {
    // 開発中は内部設定に従う
    return path.join(__dirname, FILE_PATH.configXml);
  }
};

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
    const xmlPath = getConfigPath();
    let xmlData = await fs.readFile(xmlPath, "utf8");

    // 外部で設定しているHTMLがそのまま読み込まれるようCDATA付与
    xmlData = injectCdata(xmlData, "head");
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

function extractSetting(html: string, tag: string, defaultValue: number): number {
  const regex = new RegExp(`<${tag}>\\s*(\\d+)\\s*<\/${tag}>`, "i");
  const match = html.match(regex);
  return match ? parseInt(match[1], 10) : defaultValue;
}

const handleIpc = <K extends keyof IpcChannels>(
  channel: K,
  listener: (event: IpcMainInvokeEvent, ...args: Parameters<IpcChannels[K]>) => Promise<ReturnType<IpcChannels[K]>> | ReturnType<IpcChannels[K]>
) => {
  ipcMain.handle(channel, listener);
};

async function createWindow() {
  const xmlObj = await readConfigXml();
  const headHtml = xmlObj?.config?.head?.__cdata || "";

  // <width>, <height>を抽出
  const width = extractSetting(headHtml, "width", 600);
  const height = extractSetting(headHtml, "height", 500);

  const win = new BrowserWindow({
    width,
    height,
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
