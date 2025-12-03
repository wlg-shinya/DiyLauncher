import { MyAPI, ConfigData, CommandOutput } from "./types.js";

declare global {
  interface Window {
    myAPI: MyAPI;
  }
}

// config.xmk内の{{}}の解決
function resolveCommandPlaceholders(commandTemplate: string): string {
  // 正規表現: {{key}} の形を探す (最短一致)
  return commandTemplate.replace(/\{\{(.*?)\}\}/g, (match, varName) => {
    // data-var="varName" を持つ要素を探す
    const inputEl = document.querySelector(`[data-var="${varName}"]`);

    // 要素が見つかり、かつ value プロパティを持っていればその値を返す
    if (inputEl && "value" in inputEl) {
      return (inputEl as HTMLInputElement).value;
    }

    // 見つからない場合は警告を出して、置換せずそのままにする
    console.warn(`Variable {{${varName}}} not found in elements with data-var="${varName}".`);
    return match;
  });
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
    const commandTemplate = el.getAttribute("data-command");
    const targetId = el.getAttribute("data-command-log-id") || undefined;
    const logFile = el.getAttribute("data-command-log-file") || undefined;

    if (commandTemplate) {
      el.style.cursor = "pointer";
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        const finalCommand = resolveCommandPlaceholders(commandTemplate);
        if (targetId) {
          const targetEl = document.getElementById(targetId);
          if (targetEl && "value" in targetEl) {
            const now = new Date().toLocaleString();
            (targetEl as HTMLTextAreaElement).value = `\n[${now}] > ${finalCommand}\n`;
          }
        }

        console.log(`実行コマンド: ${finalCommand}`);
        await window.myAPI.runCommand(finalCommand, targetId, logFile);
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
    // 上記以外
    else {
      targetEl.innerText += data.text;
    }
  });
});
