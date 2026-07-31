# DIY Launcher

https://github.com/user-attachments/assets/860ecad1-e1db-44b3-bdd3-fa1eb9cd7abb

これは自由に UI をレイアウトしてコマンドを設定できる、あなただけのランチャーが作れるアプリケーションです。

This application allows you to create your own personalized launcher by freely customizing the UI layout and configuring commands.

## 使いかた Usage

1. ダウンロードしたインストーラーを実行してお好きな場所にインストールしてください。
1. インストールしたディレクトリにある `DiyLauncher.exe` を起動してください。同じ場所に `config.xml` と `icon.ico` が生成されます。
1. `config.xml` をメモ帳などで開きます。
1. 起動したアプリを見ながら、ボタンやタイトルやウィンドウサイズやコマンドを自由に設定して保存してください。設定の仕方は `config.xml` のコメントを参考にしてください。
1. [任意]icon.ico はお好きなアイコンに差し替えてください。

<br>

1. Run the downloaded installer and install the application to your preferred location.
2. Launch `DiyLauncher.exe` in the installation directory. `config.xml` and `icon.ico` will be generated in the same directory.
1. Open `config.xml` using a text editor (such as Notepad).
1. While referring to the launched application, customize the buttons, titles, window size, and commands to your preference, then save the file. Please refer to the comments in `config.xml` for configuration instructions.
1. [Optional] Replace icon.ico with any icon of your choice.

## 注意事項 Important Notes

- `config.xml` の記述を間違えると起動しない場合があります。その場合は記述を見直してください。
- XSS やコマンドインジェクションへの対策は行っていません。ほかの人が作成した `config.xml` を使う場合は十分注意してください。

<br>

- The application may fail to launch if there are syntax errors in `config.xml`. If this happens, please review your edits.
- Security measures against XSS or command injection have not been implemented. Please exercise extreme caution when using a `config.xml` file created by someone else.

## 免責事項 Disclaimer

本アプリの利用により発生した損害について、当方は責任を負わないものとします。

The author assumes no responsibility for any damages resulting from the use of this application.






