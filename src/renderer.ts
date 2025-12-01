// preload.ts で定義した型と合わせるためのアンビエント宣言
// これがないと window.myAPI で「そんなプロパティないよ」と怒られます
interface LauncherButton {
  label: string;
  command: string;
}

interface IMyAPI {
  loadConfig: () => Promise<LauncherButton[]>;
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

  const buttons = await window.myAPI.loadConfig();

  buttons.forEach((btnData) => {
    const btn = document.createElement("button");
    btn.className = "launcher-btn";
    btn.innerHTML = btnData.label;

    btn.onclick = async () => {
      console.log("実行コマンド:", btnData.command);
      await window.myAPI.runCommand(btnData.command);
    };

    appDiv.appendChild(btn);
  });
});
