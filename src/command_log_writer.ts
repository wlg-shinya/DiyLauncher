import path from "node:path";
import fsCallback from "node:fs";
import { getConfigPath } from "./config_helper.js";

export class CommandLogWriter {
  private stream: fsCallback.WriteStream | null = null;

  constructor(logFile: string | undefined, command: string) {
    if (logFile) {
      try {
        const filePath = this.resolveLogPath(logFile);
        this.stream = fsCallback.createWriteStream(filePath, { flags: "a" });
        const now = new Date().toLocaleString();
        this.stream.write(`\n--- [${now}] Command: ${command} ---\n`);
      } catch (err) {
        console.error("ログファイル作成失敗:", err);
      }
    }
  }

  // テキストの書き込み
  write(text: string, type: "stdout" | "stderr" | "exit") {
    if (!this.stream) return;

    if (type !== "exit") {
      this.stream.write(text);
    } else {
      this.stream.write(`\n[Exited]\n`);
    }
  }

  // ストリームを閉じる
  close() {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }

  // CONFIG_ATTR.LOG_IDで指定されたログファイルパスの解決
  private resolveLogPath(userPath: string): string {
    const configDir = path.dirname(getConfigPath());
    const fullPath = path.join(configDir, userPath);
    const targetDir = path.dirname(fullPath);

    if (!fsCallback.existsSync(targetDir)) {
      try {
        fsCallback.mkdirSync(targetDir, { recursive: true });
      } catch (err) {
        console.error("ディレクトリ作成失敗:", err);
        // エラー時は書き込みに失敗するだけなので、ここではパスをそのまま返す
      }
    }

    return fullPath;
  }
}
