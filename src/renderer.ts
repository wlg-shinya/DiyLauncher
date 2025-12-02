import { MyAPI, ConfigData } from "./types.js";

declare global {
  interface Window {
    myAPI: MyAPI;
  }
}

function renderApp(data: ConfigData) {
  const { head, body } = data;

  document.head.innerHTML = head;
  document.body.innerHTML = body;

  const commandElements = document.body.querySelectorAll("[data-command]");
  commandElements.forEach((element) => {
    const el = element as HTMLElement;
    const command = el.getAttribute("data-command");
    if (command) {
      el.style.cursor = "pointer";
      // イベントリスナーの重複登録を防ぐため、HTML書き換え直後なら単純追加でOK
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log(`実行コマンド: ${command}`);
        await window.myAPI.runCommand(command);
      });
    }
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  // 初回ロード
  const initialData = await window.myAPI.loadConfig();
  renderApp(initialData);

  // 更新通知を受け取ったら再描画
  window.myAPI.onConfigUpdate((newData) => {
    console.log("設定ファイルが更新されました。画面をリロードします。");
    renderApp(newData);
  });
});
