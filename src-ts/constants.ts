// config.xmlで使用するカスタム属性名の定義
export const CONFIG_ATTR = {
  COMMAND: "data-command",
  COMMAND_LOG_ID: "data-command-log-id",
  COMMAND_LOG_FILE: "data-command-log-file",
  COMMAND_LOG_MODE: "data-command-log-mode",
  COMMAND_OUTPUT_VAR: "data-command-output-var",
  COMMAND_DETACH: "data-command-detach",
  VAR: "data-var",
  AUTO_CLICK: "data-auto-click",
} as const;

// config.xmlで使用する変数の定義
export const CONFIG_VAR = {
  PACKAGE_VERSION: "PACKAGE_VERSION",
  NOW: "NOW",
} as const;