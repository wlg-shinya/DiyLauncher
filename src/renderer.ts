import { MyAPI, ConfigData, CommandOutput } from "./types.js";

declare global {
  interface Window {
    myAPI: MyAPI;
  }
}

function renderApp(data: ConfigData) {
  const { head, body } = data;

  // HTMLの更新
  document.head.innerHTML = head;
  document.body.innerHTML = body;

  // コマンドボタンのイベント設定
  const commandElements = document.body.querySelectorAll("[data-command]");
  commandElements.forEach((element) => {
    const el = element as HTMLElement;

    const command = el.getAttribute("data-command");
    const targetId = el.getAttribute("data-command-log-id") || undefined;
    const logFile = el.getAttribute("data-command-log-file") || undefined;

    if (command) {
      el.style.cursor = "pointer";

      // クリックイベント
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        if (targetId) {
          const targetEl = document.getElementById(targetId);
          if (targetEl && "value" in targetEl) {
            const now = new Date().toLocaleString();
            (targetEl as HTMLTextAreaElement).value = `\n[${now}] ${command}\n`;
          }
        }
        console.log(`実行コマンド: ${command}`);
        await window.myAPI.runCommand(command, targetId, logFile);
      });
    }
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  // 初期ロード
  const initialData = await window.myAPI.loadConfig();
  renderApp(initialData);

  // 設定ファイル更新時のホットリロード
  window.myAPI.onConfigUpdate((newData) => {
    console.log("設定が更新されました。画面をリロードします。");
    renderApp(newData);
  });

  // コマンド出力を受け取って表示
  window.myAPI.onCommandOutput((data: CommandOutput) => {
    const targetEl = document.getElementById(data.targetId);
    if (!targetEl) return;

    // <textarea> や <input> の場合
    if ("value" in targetEl) {
      const inputEl = targetEl as HTMLTextAreaElement;
      inputEl.value += data.text;
      inputEl.scrollTop = inputEl.scrollHeight; // 常に一番下へスクロール
    }
    // <div> や <span> などの場合
    else {
      // 簡易的な追記（改行コードはHTMLでは無視されるため preタグ推奨）
      targetEl.innerText += data.text;
    }
  });
});
