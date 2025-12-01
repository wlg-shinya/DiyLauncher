interface IMyAPI {
  loadConfig: () => Promise<string>;
  runCommand: (command: string) => Promise<void>;
}

declare global {
  interface Window {
    myAPI: IMyAPI;
  }
}

const appDiv = document.getElementById("app");

window.addEventListener("DOMContentLoaded", async () => {
  if (!appDiv) return;

  // HTML文字列をそのまま流し込む
  const htmlContent = await window.myAPI.loadConfig();
  appDiv.innerHTML = htmlContent;

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
