import { MyAPI } from "./types.js";

declare global {
  interface Window {
    myAPI: MyAPI;
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const { head, body } = await window.myAPI.loadConfig();

  document.head.innerHTML = head;
  document.body.innerHTML = body;

  const commandElements = document.body.querySelectorAll("[data-command]");
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
