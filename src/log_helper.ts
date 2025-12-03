import path from "node:path";
import fsCallback from "node:fs";
import { getConfigPath } from "./config_helper.js";

// data-command-log-fileで指定されたログファイルパスの解決
export const resolveLogPath = (userPath: string): string => {
  // ルートとユーザー指定パスを結合
  // 例: "C:/.../resources" + "logs/sub/test.log"
  const configDir = path.dirname(getConfigPath());
  const fullPath = path.join(configDir, userPath);

  // ディレクトリ部分だけ抽出
  const targetDir = path.dirname(fullPath);

  // ディレクトリが存在しなければ、親を含めて再帰的に作成
  if (!fsCallback.existsSync(targetDir)) {
    try {
      fsCallback.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
      console.error("ディレクトリ作成失敗:", err);
    }
  }

  return fullPath;
};
