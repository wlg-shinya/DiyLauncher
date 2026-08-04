import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_NAME = path.parse(fileURLToPath(import.meta.url)).name;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OS_PARAMS = {
  win32: {
    FONT_FAMILY: '"Meiryo", sans-serif',
    APP_TEXT_EDITOR_CMD: "notepad.exe",
    APP_TEXT_EDITOR_LABEL: "🗒️メモ帳",
    APP_UTIL_CMD: "charmap.exe",
    APP_UTIL_LABEL: "🔤文字コード表",
    PING_COUNT_OPT: "-n",
  },
};

function generateConfigDefaultXml() {
  const platform = process.platform;
  const params = OS_PARAMS[platform] || OS_PARAMS.win32;

  const templatePath = path.resolve(__dirname, "../config.default.template.xml");
  const outputDir = path.resolve(__dirname, "../src-tauri/resources");
  const outputPath = path.join(outputDir, "config.default.xml");

  if (!fs.existsSync(templatePath)) {
    console.error(`[${SCRIPT_NAME}] Error: テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let content = fs.readFileSync(templatePath, "utf-8");

  // @TAG@ の置き換え
  Object.entries(params).forEach(([key, value]) => {
    const regex = new RegExp(`@${key}@`, "g");
    content = content.replace(regex, value);
  });

  fs.writeFileSync(outputPath, content, "utf-8");
  console.log(`[${SCRIPT_NAME}] Success: ${outputPath} を生成しました。`);
}

generateConfigDefaultXml();