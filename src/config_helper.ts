import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import { ROOT_PATH } from "./constants.js";
import { XmlStructure, ConfigData } from "./types.js";

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

export function getConfigPath(): string {
  if (app.isPackaged) {
    // 本番はexeと同じ階層にある resources フォルダの中を見る
    return path.join(process.resourcesPath, "config.xml");
  } else {
    // 開発中はルートを見る
    return path.join(ROOT_PATH, "config.xml");
  }
}

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

export function extractConfigCustomSetting(html: string, tag: string, defaultValue: number): number {
  const regex = new RegExp(`<${tag}>\\s*(\\d+)\\s*<\/${tag}>`, "i");
  const match = html.match(regex);
  return match ? parseInt(match[1], 10) : defaultValue;
}

export function convertToConfigData(xmlObj: XmlStructure | null): ConfigData {
  const headHtml = xmlObj?.config?.head?.__cdata || "";
  const bodyHtml = xmlObj?.config?.body?.__cdata || "<div>No Body</div>";
  return {
    head: headHtml,
    body: bodyHtml,
  };
}
