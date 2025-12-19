import { app, BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import fsCallback from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { ROOT_PATH } from "./file_paths.js";
import { XmlStructure, ConfigData } from "../types.js";

// CDATA注入
function injectCdata(xmlString: string, tag: string): string {
  // <tag> と </tag> の間のあらゆる文字を取得し、CDATAで囲んで置換
  const regex = new RegExp(`(<${tag}>)([\\s\\S]*?)(<\/${tag}>)`, "gi");
  return xmlString.replace(regex, (match, openTag, content, closeTag) => {
    // 既にCDATAがある場合は二重にならないように配慮（念のため）
    if (content.trim().startsWith("<![CDATA[")) {
      return match;
    }
    return `${openTag}<![CDATA[${content}]]>${closeTag}`;
  });
}

// 設定ファイルへのパス取得
export function getConfigPath(): string {
  if (app.isPackaged) {
    // 本番はexeと同じ階層にある resources フォルダの中を見る
    return path.join(process.resourcesPath, "config.xml");
  } else {
    // 開発中はルートを見る
    return path.join(ROOT_PATH, "config.xml");
  }
}

// 設定ファイルがなければ作成する
export async function ensureConfigExists() {
  const resourcePath = app.isPackaged ? process.resourcesPath : ROOT_PATH;
  const configPath = path.join(resourcePath, "config.xml");
  const defaultPath = path.join(resourcePath, "config.default.xml");
  try {
    // config.xml が存在すれば何もしない
    await fs.access(configPath);
  } catch {
    // 存在しない場合 (初回起動など)、default をコピーして作成
    try {
      await fs.copyFile(defaultPath, configPath);
      console.log("config.xml を初期生成しました");
    } catch (err) {
      console.error("config.default.xml のコピーに失敗しました:", err);
    }
  }
}

// 設定ファイルの読み込み
export async function readConfig(): Promise<XmlStructure | null> {
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

// 設定ファイルのカスタム設定を抽出
export function extractConfigCustomSetting(html: string, tag: string, defaultValue: number): number {
  const regex = new RegExp(`<${tag}>\\s*(\\d+)\\s*<\/${tag}>`, "i");
  const match = html.match(regex);
  return match ? parseInt(match[1], 10) : defaultValue;
}

// XMLを設定ファイルのデータ構造に変換
export function convertToConfigData(xmlObj: XmlStructure | null): ConfigData {
  const headHtml = xmlObj?.config?.head?.__cdata || "";
  const bodyHtml = xmlObj?.config?.body?.__cdata || "<div>No Body</div>";
  return {
    head: headHtml,
    body: bodyHtml,
    version: app.getVersion(),
  };
}

// 設定ファイルホットリロードのためのセットアップ
export function setupConfigWatcher(win: BrowserWindow) {
  const configPath = getConfigPath();
  let fsWait = false;

  fsCallback.watch(configPath, async (event) => {
    if (fsWait) return;

    if (event === "change") {
      fsWait = true;
      // 連続発火防止 (デバウンス処理)
      setTimeout(async () => {
        fsWait = false;
        console.log("設定が更新されました。");

        // 設定を読み直す
        const xmlObj = await readConfig();

        // ウィンドウサイズの更新処理
        const headHtml = xmlObj?.config?.head?.__cdata || "";
        const newWidth = extractConfigCustomSetting(headHtml, "width", 600);
        const newHeight = extractConfigCustomSetting(headHtml, "height", 500);

        // フレームの差分を計算してリサイズする
        const [winW, winH] = win.getSize();
        const [contentW, contentH] = win.getContentSize();
        const borderW = winW - contentW;
        const borderH = winH - contentH;
        if (Math.abs(contentW - newWidth) > 2 || Math.abs(contentH - newHeight) > 2) {
          win.setSize(newWidth + borderW, newHeight + borderH, false);
        }

        // 画面に送信
        const configData = convertToConfigData(xmlObj);
        win.webContents.send("on-config-updated", configData);
      }, 100);
    }
  });
}
