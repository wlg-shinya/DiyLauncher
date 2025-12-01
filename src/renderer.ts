import { MyAPI } from "./types.js";

declare global {
  interface Window {
    myAPI: MyAPI;
  }
}

const appDiv = document.getElementById("app");

window.addEventListener("DOMContentLoaded", async () => {
  if (!appDiv) return;

  const { title, css, html } = await window.myAPI.loadConfig();

  // タイトルを反映
  document.title = title;

  // CSSを適用する
  const userCustomStyleName = "user-custom-style";
  const userCustomStyle = document.getElementById(userCustomStyleName);
  if (userCustomStyle) userCustomStyle.remove();
  const styleTag = document.createElement("style");
  styleTag.id = userCustomStyleName;
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  // HTML文字列をそのまま流し込む
  appDiv.innerHTML = html;

  // data-command 属性を持つ全ての要素にイベントリスナーを付与する
  const commandElements = appDiv.querySelectorAll("[data-command]");
  commandElements.forEach((element) => {
    const el = element as HTMLElement;
    const command = el.getAttribute("data-command");
    if (command) {
      el.style.cursor = "pointer";
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log(`実行コマンド: ${command}`);
        await window.myAPI.runCommand(command);
      });
    }
  });
});
