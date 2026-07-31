// config.xmlで使用するカスタム属性名の定義
export const CONFIG_ATTR = {
  COMMAND: "data-command",
  LOG_ID: "data-command-log-id",
  LOG_FILE: "data-command-log-file",
  LOG_MODE: "data-command-log-mode",
  OUTPUT_VAR: "data-command-output-var",
  VAR: "data-var",
  AUTO_CLICK: "data-auto-click",
} as const;

// config.xmlで使用する変数の定義
export const CONFIG_VAR = {
  PACKAGE_VERSION: "PACKAGE_VERSION",
  NOW: "NOW",
} as const;