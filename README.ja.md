# fpasoterm

![fpasoterm logo](extra/logo/fpasoterm.png)

英語版: [README.md](README.md)。インストール手順は[日本語](INSTALL.ja.md)と[English](INSTALL.md)を参照してください。

fpasoterm は Tauri、xterm.js、Rust PTY bridge を使った Terminal アプリです。ChromeOS Linux での日本語入力を重視しつつ、将来的に他 OS へ展開しやすい構成にしています。

screen / tmux / byobu / herdr などの terminal multiplexer と併用する前提です。fpasoterm 自身では画面分割を行いませんが、titlebar の `Tile` button で複数 window を並べられます。

fpasoterm は `かな` / `英数` キーを横取りしません。日本語入力の切替と composition は OS webview と xterm.js に任せます。

## 必要な環境

詳細な導入手順は [INSTALL.ja.md](INSTALL.ja.md) を参照してください。ChromeOS Linux で開発する場合は、Node.js、Rust、および Tauri/WebKitGTK 用の system package が必要です。

## 起動

起動:

```sh
npm install
./scripts/run
```

リリース用 bundle を作らず、まず起動だけ確認する場合:

```sh
./bin/fpasoterm --dev
```

この起動方法は古い `src-tauri/target/release/fpasoterm` が存在していても無視し、localhost の開発serverを使わないdebug binaryで現在のsourceを使います。
現在のコンソールでログを見たい場合だけ `--foreground --console-diagnostics` を追加してください。

shell で `exit` を実行すると fpasoterm のウィンドウも閉じます。

## コマンドラインオプション

cached runtime を使用する通常起動ではコンソールから切り離して起動し、すぐに shell prompt が戻ります。

```sh
fpasoterm
```

source checkoutまたはnpm packageの初回起動でlocal Cargo buildが必要な場合は、CLIを接続したまま`phase 1/3`の準備、`phase 2/3`のcompiler progress、`phase 3/3`のnative window起動を表示します。Cargo errorもこのterminalへ表示し、window process起動後にpromptが戻ります。runtime解決、Cargo build、desktop spawnの経過時間とcompiler outputはLinux/macOSでは`~/.cache/fpasoterm/launcher.log`、Windowsでは`%LOCALAPPDATA%\\fpasoterm\\launcher.log`にも記録します。desktop processの終了まで待機したい場合だけ、`--foreground --console-diagnostics`を使ってください。

オプション一覧:

```sh
fpasoterm --help
```

起動せずに version を確認:

```sh
fpasoterm --version
fpasoterm -v
```

一時的な設定上書き:

```sh
fpasoterm --config ~/.config/fpasoterm/User/work.toml
fpasoterm --size 1200x760
fpasoterm --width 1200 --height 760
fpasoterm --shell /bin/fish
fpasoterm --command "tmux attach -t work"
fpasoterm --title work --titlebar-color '#2e7d32'
```

よく使う一時指定には短縮形も使えます。

```sh
fpasoterm -t work -b '#2e7d32' -z 1200x760 -s /bin/fish
fpasoterm -e "tmux attach -t work"
```

起動中の window は、POSIX shell を使っている場合は terminal 内の command からも変更できます。

```sh
printf '\033]0;work\a\r\n'
printf '\033]777;titlebarColor=#2e7d32\a\r\n'
printf '\033]777;opacity=0.65\a\r\n'
printf '\033]777;title=work;titlebarColor=#2e7d32\a\r\n'
```

Windows PowerShell や cmd.exe では、この `printf` 例はそのまま使えません。
PowerShell 形式、または下記 helper script を使ってください。

```powershell
[Console]::Write("$([char]27)]777;title=work;titlebarColor=#2e7d32$([char]7)`r`n")
```

runtime config sample は次で適用できます。

```sh
./examples/apply-runtime-appearance.sh
```

Windows PowerShell または cmd.exe では次を使えます。

```powershell
.\examples\apply-runtime-appearance.ps1
.\examples\apply-runtime-appearance.bat
```

この sample は title を `RUNTIME SAMPLE ACTIVE` にし、titlebar をピンク、
terminal 背景と文字色を分かりやすく変更します。

起動中の window を標準の見た目へ戻す場合:

```sh
./examples/apply-default-appearance.sh
```

Windows PowerShell または cmd.exe では次を使えます。

```powershell
.\examples\apply-default-appearance.ps1
.\examples\apply-default-appearance.bat
```

path を手動指定する場合:

```sh
config_path="$(pwd)/examples/config/runtime-appearance.toml"
printf '\033]777;config=%s\a\r\n' "$config_path"
```

Windows PowerShell で path を手動指定する場合:

```powershell
$configPath = Resolve-Path .\examples\config\runtime-appearance.toml
[Console]::Write("$([char]27)]777;config=$configPath$([char]7)`r`n")
```

runtime config 適用では、現在の shell session は維持されます。
`window.title`、`window.titlebarColor`、`window.width`、`window.height`、
`terminal.fontSize`、`terminal.lineHeight`、`terminal.fontFamily`、`terminal.backgroundOpacity`、`terminal.theme` など、起動中に反映可能な表示設定を適用します。
`terminal.shell` のように新しい PTY が必要な設定は次回起動時に反映されます。

起動せずに解決済み設定と plugin 読み込み状況を確認:

```sh
fpasoterm --show-config
fpasoterm --config ~/.config/fpasoterm/User/work.toml --show-config
```

windowを開かずに設定を検証し、Issue向けMarkdown reportを作成する場合:

```sh
fpasoterm --config-check
fpasoterm --diagnostics
fpasoterm --copy-diagnostics
fpasoterm --open-log-dir
```

出力内容、exit status、clipboard要件は[設定と診断](docs/diagnostics.ja.md)を参照してください。

名前付きの表示・shell profileを一回の起動だけ使う場合は
`fpasoterm --profile <name>`を使用します。詳細は[Profile](docs/config.ja.md#profile)を参照してください。

起動中のwindowを新しいwindowを開かずに一覧表示:

```sh
fpasoterm --list
fpasoterm -l
```

各行にprocess/session ID、表示title、起動時刻を表示します。

process ID、表示titleの完全一致、または予約targetの`all`で起動中のwindowを閉じます:

```sh
fpasoterm --close 12345
fpasoterm -q review-shell
fpasoterm --close all
```

Windows の packaged `fpasoterm.exe` を直接起動した場合、`--show-config` は
解決済み runtime config を JSON で出力します。Node launcher を使える場合は
TOML と plugin load detail を表示します。
Windows で古い installer から上書き更新した後は `fpasoterm --version` を確認してください。
古い UI が表示され、かつ `--version` も古い version を返す場合、`Path`、Start menu、pinned shortcut のいずれかが古い executable を起動しています。起動中の fpasoterm を閉じ、新しい installer を再実行してから更新後の shortcut で起動してください。

`config.toml` の plugin を有効化・無効化:

```sh
fpasoterm --enable-plugin hello.ts,theme.ts
fpasoterm --disable-plugin hello.ts,theme.ts
```

plugin enable/disable command は Node launcher が処理します。packaged binary
を直接起動している場合は、`config.toml` を手動編集するか、npm install された
`fpasoterm` command を使ってください。

デバッグ時にコンソールへ接続したまま起動する場合:

```sh
fpasoterm --foreground --console-diagnostics
```

source checkout で動作だけ確認する場合:

```sh
./bin/fpasoterm --dev
```

ChromeOS/Baguette で透過や描画が不安定な場合:

```sh
fpasoterm --disable-dmabuf
```

## 設定とプラグイン

fpasoterm は以下の設定を読み込みます。

```text
~/.config/fpasoterm/User/config.toml
```

初回起動時には以下にサンプルを書き出します。

```text
~/.config/fpasoterm/User/config.toml.example
```

例:

```toml
[terminal]
fontSize = 15
lineHeight = 1.12
fontFamily = "Noto Sans Mono CJK JP, monospace"

[ime]
duplicateGuard = true
duplicateWindowMs = 800
repeatedTextWindowMs = 140

[plugins]
enabled = ["plugins/example.ts"]
```

プラグインは `~/.config/fpasoterm/User/plugins/` 配下に置きます。JavaScript (`.js`) と TypeScript (`.ts`) に対応しています。TypeScript plugin は起動時に `~/.config/fpasoterm/User/cache/plugins/` へ変換されます。plugin は renderer context で動作するため、内容を確認した信頼できるローカル file だけを有効にしてください。

plugin は `version` を参照し、`onReady()` で起動後の処理を登録し、`registerCommand()` で hamburger menu の `Plugins` section に action を追加できます。`fpasoterm --plugin-list` で検出済み・有効な plugin を確認し、`--plugin-enable` / `--plugin-disable` で有効 list を更新できます。`fpasoterm --plugin-info welcome-banner.ts`ではsource、有効状態、description、load statusを確認できます。有効化またはsource変更後は対象windowを再起動してください。

最小の TypeScript plugin:

```ts
/// <reference path="/path/to/fpasoterm/docs/fpasoterm-plugin.d.ts" />

const api = window.fpasotermPluginApi;
api.log('example plugin loaded');
api.terminal.options.cursorBlink = true;
```

二重入力が残る環境では、`config.toml` の `ime.duplicateWindowMs` または `ime.repeatedTextWindowMs` を少し大きくしてください。

全デフォルト設定は [設定](docs/config.ja.md) にまとめています。plugin の設定方法、security 上の注意、CLI 管理、対応 API の declaration は [プラグイン](docs/plugins.ja.md) と [`docs/fpasoterm-plugin.d.ts`](docs/fpasoterm-plugin.d.ts) を参照してください。設定 sample は [examples/config](examples/config)、公開 plugin sample は [examples/plugins](examples/plugins) にあります。

複数端末間のメンテナンス用途では、Google Drive for desktop などのローカル同期フォルダを使って、diagnostics と terminal output log を共有できます。Google Drive API や OAuth は使いません。詳細は [Sync Folder](docs/sync.ja.md) を参照してください。
Kitty Graphics Protocol、SIXEL、iTerm inline image は、image stream により Tauri/WebKitGTK renderer が停止することがあるため、現在は未対応です。`Ctrl+Shift+B` の Broadcast Input は対象の local fpasoterm window を選択して同じ command を送信でき、trusted な同期フォルダを使う場合は別 machine で既に起動している全 instance にも短寿命 command を送れます。詳細は [設定](docs/config.ja.md) と [Sync Folder](docs/sync.ja.md) を参照してください。
初回設定は `fpasoterm --setup-sync` で質問に答えるだけで作成できます。
Windows の source checkout では `node .\bin\fpasoterm --setup-sync` を使います。
terminal output log は hamburger menu の `Log Start (^S)` / `Log Stop (^S)` または `Ctrl+Shift+S` で取得し、`Log Show (^P)` または `Ctrl+Shift+P` で active log または `Log Stop` で閉じた最後の log を表示できます。共有したい場合は `logging.directory` を同期フォルダに向けます。
log panel には検索欄と `Search` ボタンがあり、表示中の log から次の一致文字列を選択してその位置へ scroll できます。`N` は次、`P` は前の一致箇所へ移動します。log text area に focus がある場合は `j` / `k` でも同じ移動ができ、矢印キーは通常の log scroll に使えます。

npm registry から global install する場合:

```sh
npm install -g fpasoterm
fpasoterm
```

開発中に link する場合:

```sh
npm link
fpasoterm
```

または:

```sh
npm install -g .
fpasoterm
```

診断:

```sh
FPASOTERM_DEBUG_KEYS=1 ./scripts/run
cat ~/.config/fpasoterm/User/logs/fpasoterm-debug.log
```

アイコンを変更する場合は `extra/logo/fpasoterm.png` を差し替え、以下を実行します。

```sh
npm run generate:icons
npm run install:desktop
```

ChromeOS Linux launcher は `extra/linux/icons/hicolor/` に生成されるサイズ別 PNG を使います。Android native package を作る場合は、この PNG を adaptive icon の元画像として使います。

## アイコン

project icon は `extra/logo/fpasoterm.png` です。Linux/ChromeOS launcher は `extra/linux/icons/hicolor/` の icon theme file を使います。macOS bundle は `extra/macos/fpasoterm.icns`、Windows bundle は `extra/windows/fpasoterm.ico` を使います。

## ライセンス

MIT。詳細は [LICENSE](LICENSE) を参照してください。

## コントリビュート

[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。release 履歴は [CHANGELOG.md](CHANGELOG.md) に記録します。

## jj repository 初期化

`main` bookmark は空の initial commit を指します。初期化は次を実行します。

```sh
cd fpasoterm
./scripts/init-jj-empty-main
```

## チェック

```sh
npm run check
npm run scan:secrets
desktop-file-validate extra/linux/io.github.oyoguhito.fpasoterm.desktop
npm run audit:prod
```

GitHub Actions は push と pull request で同じ check を実行します。

## ドキュメント

- [仕様](docs/spec.ja.md)
- [設定](docs/config.ja.md)
- [Sync Folder](docs/sync.ja.md)
- [Pull request review](docs/pr-review.ja.md)
- [リリースチェックリスト](docs/release-checklist.ja.md)
- [既知課題](docs/known-issues.ja.md)
