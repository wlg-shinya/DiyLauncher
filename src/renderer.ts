import { MyAPI, ConfigData, CommandOutput } from "./types.js";
import { CONFIG_ATTR, CONFIG_VAR } from "./constants.js";

declare global {
  interface Window {
    myAPI: MyAPI;
  }
}

// config.xmk内の{{}}の解決
function resolveCommandPlaceholders(commandTemplate: string): string {
  // 正規表現: {{key}} の形を探す (最短一致)
  return commandTemplate.replace(/\{\{(.*?)\}\}/g, (match, varName) => {
    const selector = `[${CONFIG_ATTR.VAR}="${varName}"]`;
    const inputEl = document.querySelector(selector);

    // 要素が見つかり、かつ value プロパティを持っていればその値を返す
    if (inputEl && "value" in inputEl) {
      return (inputEl as HTMLInputElement).value;
    }

    // 見つからない場合は警告を出して、置換せずそのままにする
    console.warn(`Variable {{${varName}}} not found in elements with ${CONFIG_ATTR.VAR}="${varName}".`);
    return match;
  });
}

function renderApp(data: ConfigData) {
  const { head, body, version } = data;

  // HTMLの更新
  const versionRegex = new RegExp(`\\{\\{${CONFIG_VAR.PACKAGE_VERSION}\\}\\}`, "g");
  const processedHead = head.replace(versionRegex, version);
  const processedBody = body.replace(versionRegex, version);
  document.head.innerHTML = processedHead;
  document.body.innerHTML = processedBody;

  // 保存されていた値を復元する
  const dataVarElements = document.body.querySelectorAll(`[${CONFIG_ATTR.VAR}]`);
  dataVarElements.forEach((element) => {
    const el = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const varName = el.getAttribute(CONFIG_ATTR.VAR);
    if (varName) {
      const storageKey = `user_input_${varName}`;
      const savedValue = localStorage.getItem(storageKey);

      // 復元
      if (savedValue !== null) {
        el.value = savedValue;
      }

      // 各種イベントごとにvalueをlocalStorageへ保存
      const saveValue = () => {
        localStorage.setItem(storageKey, el.value);
      };
      // input: テキストボックスなどで一文字打つごとに発火
      el.addEventListener("input", saveValue);
      // change: selectボックスの変更や、フォーカスが外れた確定時に発火
      el.addEventListener("change", saveValue);
    }
  });

  // コマンドボタンのイベント設定
  const commandElements = document.body.querySelectorAll(`[${CONFIG_ATTR.COMMAND}]`);
  commandElements.forEach((element) => {
    const el = element as HTMLElement;
    const commandTemplate = el.getAttribute(CONFIG_ATTR.COMMAND);
    const targetId = el.getAttribute(CONFIG_ATTR.LOG_ID) || undefined;
    const logFile = el.getAttribute(CONFIG_ATTR.LOG_FILE) || undefined;

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
