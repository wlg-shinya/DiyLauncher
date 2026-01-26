import { MyAPI, ConfigData, CommandOutput } from "../types.js";
import { CONFIG_ATTR, CONFIG_VAR } from "../constants.js";

declare global {
  interface Window {
    myAPI: MyAPI;
  }
}

function updateDynamicView() {
  const dynamicElements = document.body.querySelectorAll("[data-template-text]");
  dynamicElements.forEach((el) => {
    const template = el.getAttribute("data-template-text") || "";
    // 最新の値で解決してテキストを更新
    el.textContent = resolveTemplate(template);
  });
}

// config.xml内の{{}}の解決
function resolveTemplate(template: string): string {
  if (!template) return "";

  return template.replace(/\{\{(.*?)\}\}/g, (match, rawVarName) => {
    const varName = rawVarName.trim();

    // [data-var="..."] (入力欄) を探す
    const inputSelector = `[${CONFIG_ATTR.VAR}="${varName}"]`;
    const inputEl = document.querySelector(inputSelector);
    if (inputEl && "value" in inputEl) {
      return (inputEl as HTMLInputElement).value;
    }

    // なければ [data-command-output-var="..."] (コマンド結果保持要素) を探す
    // ※ inputタグ以外でも値を保持できるように data-value 属性を利用する
    const outputSelector = `[${CONFIG_ATTR.OUTPUT_VAR}="${varName}"]`;
    const outputEl = document.querySelector(outputSelector);
    if (outputEl) {
      // data-value属性に値が入っていればそれを返す
      const val = outputEl.getAttribute("data-value");
      if (val !== null) return val;
    }

    // 見つからない、または値がない場合は置換しない
    return match;
  });
}

function executeScripts(container: HTMLElement) {
  const scripts = container.querySelectorAll("script");
  scripts.forEach((oldScript) => {
    const newScript = document.createElement("script");
    Array.from(oldScript.attributes).forEach((attr) => {
      newScript.setAttribute(attr.name, attr.value);
    });
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode?.replaceChild(newScript, oldScript);
  });
}

function renderApp(data: ConfigData) {
  if (!data) return;
  if (!CONFIG_VAR || !CONFIG_VAR.PACKAGE_VERSION) return;

  const { head, body, version } = data;

  const versionRegex = new RegExp(`\\{\\{${CONFIG_VAR.PACKAGE_VERSION}\\}\\}`, "g");
  const processedHead = (head || "").replace(versionRegex, version);
  const processedBody = (body || "").replace(versionRegex, version);

  document.head.innerHTML = processedHead;
  document.body.innerHTML = processedBody;

  executeScripts(document.head);
  executeScripts(document.body);

  // data-var (入力欄) のイベント設定
  const dataVarElements = document.body.querySelectorAll(`[${CONFIG_ATTR.VAR}]`);
  
  dataVarElements.forEach((element) => {
    const el = element as HTMLInputElement;
    const varName = el.getAttribute(CONFIG_ATTR.VAR);
    if (varName) {
      const storageKey = `user_input_${varName}`;
      const savedValue = localStorage.getItem(storageKey);

      if (savedValue !== null) {
        el.value = savedValue;
      }

      const saveValue = () => {
        localStorage.setItem(storageKey, el.value);
        updateDynamicView();
      };
      el.addEventListener("input", saveValue);
      el.addEventListener("change", saveValue);
    }
  });

  // テキストノードの初期スキャン ({{}} を探す)
  const allElements = document.body.getElementsByTagName("*");
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
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
    const outputVarName = el.getAttribute(CONFIG_ATTR.OUTPUT_VAR);

    if (commandTemplate) {
      el.style.cursor = "pointer";
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        // 実行直前の値を解決してコマンド作成
        const finalCommand = resolveTemplate(commandTemplate);

        // 値取得モード
        if (outputVarName) {
          try {
            const result = await window.myAPI.getCommandOutput(finalCommand);

            // data-varがあれば優先してセット
            const inputSelector = `[${CONFIG_ATTR.VAR}="${outputVarName}"]`;
            const inputEl = document.querySelector(inputSelector) as HTMLInputElement;

            if (inputEl && "value" in inputEl) {
              inputEl.value = result;
              inputEl.dispatchEvent(new Event("input"));
            } else {
              // 入力欄がない場合、自分自身に値を保持させる
              const outputSelector = `[${CONFIG_ATTR.OUTPUT_VAR}="${outputVarName}"]`;
              const outputEls = document.querySelectorAll(outputSelector);
              
              outputEls.forEach(target => {
                 // inputタグ以外は data-value 属性に値を格納する
                 target.setAttribute("data-value", result);
              });

              // 値を属性に入れただけでは画面が変わらないので、明示的に再描画を呼ぶ
              updateDynamicView();
            }
          } catch (err) {
            console.error("Failed to get command output:", err);
          }
        } else {
          // ログ出力モード
          const finalTargetId = targetIdTemplate ? resolveTemplate(targetIdTemplate) : undefined;
          const finalLogFile = logFileTemplate ? resolveTemplate(logFileTemplate) : undefined;

          if (finalTargetId) {
            const targetEl = document.getElementById(finalTargetId);
            if (targetEl && "value" in targetEl) {
              const now = new Date().toLocaleString();
              (targetEl as HTMLTextAreaElement).value = `\n[${now}] ${finalCommand}\n`;
            }
          }
          await window.myAPI.runCommandWithLog(finalCommand, finalTargetId, finalLogFile);
        }
      });
    }
  });

  // 自動クリックロジック
  const autoClickElements = document.body.querySelectorAll(`[${CONFIG_ATTR.AUTO_CLICK}]`);
  if (autoClickElements.length > 0) {
    setTimeout(() => {
      autoClickElements.forEach((element) => {
        (element as HTMLElement).click();
      });
    }, 100);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const initialData = await window.myAPI.loadConfig();
    renderApp(initialData);

    window.myAPI.onConfigUpdate((newData) => {
      renderApp(newData);
    });

    window.myAPI.onCommandOutput((data: CommandOutput) => {
      const targetEl = document.getElementById(data.targetId);
      if (!targetEl) return;

      const isInput = "value" in targetEl;
      const currentText = isInput ? (targetEl as HTMLInputElement).value : targetEl.textContent || "";
      const MAX_LOG_LENGTH = 50000;

      let newText = currentText + data.text;
      if (newText.length > MAX_LOG_LENGTH) {
        newText = "..." + newText.slice(-MAX_LOG_LENGTH);
      }

      if (isInput) {
        const inputEl = targetEl as HTMLTextAreaElement;
        inputEl.value = newText;
        inputEl.scrollTop = inputEl.scrollHeight;
      } else {
        targetEl.textContent = newText;
        targetEl.style.whiteSpace = "pre-wrap";
        targetEl.style.overflowY = "auto";
        targetEl.scrollTop = targetEl.scrollHeight;
      }
    });
  } catch (err) {
    console.error("初期化エラー:", err);
  }
});
