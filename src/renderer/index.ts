import { MyAPI, ConfigData, CommandOutput } from "../types.js";
import { CONFIG_ATTR, CONFIG_VAR } from "../constants.js";

declare global {
  interface Window {
    myAPI: MyAPI;
  }
}

// config.xml内の{{}}の解決
function resolveTemplate(template: string): string {
  if (!template) return "";

  return template.replace(/\{\{(.*?)\}\}/g, (match, rawVarName) => {
    const varName = rawVarName.trim();

    // [data-var="..."] を探す
    const selector = `[${CONFIG_ATTR.VAR}="${varName}"]`;
    try {
      const inputEl = document.querySelector(selector);
      if (inputEl && "value" in inputEl) {
        return (inputEl as HTMLInputElement).value;
      }
    } catch {
      // 見つからない場合は置換しない
    }
    return match;
  });
}

function renderApp(data: ConfigData) {
  // データの安全性チェック
  if (!data) {
    console.error("ConfigData is null or undefined");
    return;
  }
  if (!CONFIG_VAR || !CONFIG_VAR.PACKAGE_VERSION) {
    console.error("定数 CONFIG_VAR が読み込めませんでした。constants.ts を確認してください。");
    return;
  }

  const { head, body, version } = data;

  // HTMLの更新
  const versionRegex = new RegExp(`\\{\\{${CONFIG_VAR.PACKAGE_VERSION}\\}\\}`, "g");
  const processedHead = (head || "").replace(versionRegex, version);
  const processedBody = (body || "").replace(versionRegex, version);

  document.head.innerHTML = processedHead;
  document.body.innerHTML = processedBody;

  // data-var (入力欄) のセットアップ
  const dataVarElements = document.body.querySelectorAll(`[${CONFIG_ATTR.VAR}]`);
  const updateDynamicView = () => {
    const dynamicElements = document.body.querySelectorAll("[data-template-text]");
    dynamicElements.forEach((el) => {
      const template = el.getAttribute("data-template-text") || "";
      el.textContent = resolveTemplate(template);
    });
  };
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
        // 入力のたびに画面のテキスト表記も更新
        updateDynamicView();
      };
      // input: テキストボックスなどで一文字打つごとに発火
      el.addEventListener("input", saveValue);
      // change: selectボックスの変更や、フォーカスが外れた確定時に発火
      el.addEventListener("change", saveValue);
    }
  });

  // テキストノードの初期スキャン ({{}} を探す)
  const allElements = document.body.getElementsByTagName("*");
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    // 子要素を持たず、かつテキストに {{ }} を含む場合
    if (el.children.length === 0 && el.textContent && el.textContent.includes("{{")) {
      el.setAttribute("data-template-text", el.textContent);
    }
  }

  // 初回描画
  updateDynamicView();

  // コマンドボタンのセットアップ
  const commandElements = document.body.querySelectorAll(`[${CONFIG_ATTR.COMMAND}]`);
  commandElements.forEach((element) => {
    const el = element as HTMLElement;

    const commandTemplate = el.getAttribute(CONFIG_ATTR.COMMAND);
    const targetIdTemplate = el.getAttribute(CONFIG_ATTR.LOG_ID);
    const logFileTemplate = el.getAttribute(CONFIG_ATTR.LOG_FILE);

    if (commandTemplate) {
      el.style.cursor = "pointer";
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        const finalCommand = resolveTemplate(commandTemplate);
        const finalTargetId = targetIdTemplate ? resolveTemplate(targetIdTemplate) : undefined;
        const finalLogFile = logFileTemplate ? resolveTemplate(logFileTemplate) : undefined;

        if (finalTargetId) {
          const targetEl = document.getElementById(finalTargetId);
          if (targetEl && "value" in targetEl) {
            const now = new Date().toLocaleString();
            (targetEl as HTMLTextAreaElement).value = `\n[${now}] ${finalCommand}\n`;
          }
        }

        await window.myAPI.runCommand(finalCommand, finalTargetId, finalLogFile);
      });
    }
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    // 初期ロード
    const initialData = await window.myAPI.loadConfig();
    renderApp(initialData);

    // 設定ファイル更新時のホットリロード
    window.myAPI.onConfigUpdate((newData) => {
      renderApp(newData);
    });

    // コマンド出力を受け取って表示
    const MAX_LOG_LENGTH = 50000; // 表示上限文字数
    window.myAPI.onCommandOutput((data: CommandOutput) => {
      const targetEl = document.getElementById(data.targetId);
      if (!targetEl) return;

      // 1. 現在のテキストを取得 (要素の種類で分岐)
      const isInput = "value" in targetEl;
      const currentText = isInput ? (targetEl as HTMLInputElement).value : targetEl.textContent || "";

      // 2. 新しいテキストを結合
      let newText = currentText + data.text;

      // 3. 上限を超えていたら先頭を切り捨てる (メモリ・描画負荷対策)
      if (newText.length > MAX_LOG_LENGTH) {
        newText = "..." + newText.slice(-MAX_LOG_LENGTH);
      }

      // 4. DOMに反映
      if (isInput) {
        // textarea / input の場合
        const inputEl = targetEl as HTMLTextAreaElement;
        inputEl.value = newText;
        inputEl.scrollTop = inputEl.scrollHeight; // 最下部へスクロール
      } else {
        // 上記以外
        targetEl.textContent = newText;

        // textContentでも改行コード(\n)が反映されるようにCSSをセット
        targetEl.style.whiteSpace = "pre-wrap";
        targetEl.style.overflowY = "auto";

        // divでもスクロール追従させる
        targetEl.scrollTop = targetEl.scrollHeight;
      }
    });
  } catch (err) {
    console.error("初期化エラー:", err);
  }
});
