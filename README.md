# DIY Launcher

これは自由に UI をレイアウトしてコマンドを設定できる、あなただけのランチャーが作れるアプリケーションです。

This application allows you to create your own personalized launcher by freely customizing the UI layout and configuring commands.

## 使いかた Usage

1. 最初に DiyLauncher.exe を起動してください。resources フォルダの中に config.xml が作成されます。
1. config.xml をメモ帳などで開きます。
1. 起動したアプリを見ながら、ボタンやタイトルやウィンドウサイズやコマンドを自由に設定して保存してください。設定の仕方は config.default.xml のコメントを参考にしてください。

<br>

1. First, launch DiyLauncher.exe. This will generate a config.xml file inside the resources folder.
1. Open config.xml using a text editor (such as Notepad).
1. While referring to the launched application, customize the buttons, titles, window size, and commands to your preference, then save the file. Please refer to the comments in config.default.xml for configuration instructions.

## 注意事項 Important Notes

- config.xml の記述を間違えると起動しない場合があります。その場合は記述を見直してください。
- XSS やコマンドインジェクションへの対策は行っていません。ほかの人が作成した config.xml を使う場合は十分注意してください。

<br>

- The application may fail to launch if there are syntax errors in config.xml. If this happens, please review your edits.
- Security measures against XSS or command injection have not been implemented. Please exercise extreme caution when using a config.xml file created by someone else.

## 免責事項 Disclaimer

本アプリの利用により発生した損害について、当方は責任を負わないものとします。

The author assumes no responsibility for any damages resulting from the use of this application.
