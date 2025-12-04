import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// distディレクトリパス
export const DIST_PATH = __dirname;

// プロジェクトルートパス
export const ROOT_PATH = path.join(__dirname, "..");

// 各種ファイルパス
export const FILE_PATH = {
  preload: path.join(DIST_PATH, "preload.js"),
  indexHtml: path.join(ROOT_PATH, "index.html"),
  icon: path.join(ROOT_PATH, "icon.ico"),
} as const;
