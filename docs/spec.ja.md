# fpasoterm 仕様

## 目的

fpasoterm は、ChromeOS Linux での日本語入力を重視したデスクトップ Terminal アプリです。将来的に他 OS へ展開しやすい構成を採用します。screen / tmux / byobu / herdr などの terminal multiplexer と併用する前提で、画面分割や複数 window の管理はアプリ側で行いません。

## 構成

- Tauri がアプリケーションウィンドウと platform webview の入力メソッド経路を担当します。
- xterm.js が renderer process で Terminal UI を描画します。
- portable-pty が Rust backend で shell 付き PTY を作成します。
- renderer と backend の通信は Tauri command / event に限定します。

## ChromeOS Linux の入力方針

fpasoterm は `かな` / `英数` などの日本語キーボードキーを横取りしません。IME の切替と composition は platform webview と OS に任せます。

npm binary 名は `fpasoterm` です。Linux では `--disable-dmabuf` により、WebKitGTK の描画診断用に `WEBKIT_DISABLE_DMABUF_RENDERER=1` を設定できます。
既定では launcher はコンソールから切り離して起動します。debug 時は `--foreground` で接続したままにできます。

npm registry から直接インストールできます。

```sh
npm install -g fpasoterm
```

展開済み checkout では、`npm run install:desktop` により `XDG_BIN_HOME` または `~/.local/bin` にローカル `fpasoterm` コマンドをインストールします。

`npm run update:desktop` は同じ command、launcher entry、hicolor icon files を上書きします。`npm run uninstall:desktop` は source checkout や npm dependencies を削除せず、インストール済みファイルだけを削除します。

プロジェクトアイコンは `extra/logo/fpasoterm.png` です。

アプリケーションウィンドウはこの PNG を runtime icon として使います。Linux desktop entry は `Icon=fpasoterm` を参照するため、installer はこの画像を対象環境の icon theme へ配置します。サイズ別 hicolor PNG は `extra/linux/icons/hicolor/` に生成します。

license は MIT です。global install で `fpasoterm` コマンドを作るため、`package.json` の `bin.fpasoterm` を公開します。

shell 付き PTY が終了した場合、fpasoterm は対応するアプリケーションウィンドウを閉じます。これにより shell で `exit` を実行すると通常の Terminal ウィンドウと同じように終了します。

## 設定とプラグイン

ユーザー設定は `~/.config/fpasoterm/User/config.toml` から読み込みます。`XDG_CONFIG_HOME` がある場合は `$XDG_CONFIG_HOME/fpasoterm/User/config.toml` を使います。
`fpasoterm --config <path>` で一度だけ別の TOML file を使えます。`--width`、`--height`、`--size` は一度だけ window size を上書きします。`--shell <command>` は一度だけ別の shell を使います。`--command <command>` は起動後に shell へ command を送ります。`--reset-window-state` は保存済み window size を削除します。
`--show-config` は解決済み設定と plugin 読み込み状況を表示します。`--enable-plugin` と `--disable-plugin` は `User/plugins` 配下から一つ以上のファイル名を選択し、`plugins.enabled` を編集します。

起動時に fpasoterm は既定値を `config.toml.example` として書き出し、古い場合は更新します。既存のユーザー設定は上書きしません。`window.rememberBounds` が有効な場合、最後の window size は `~/.config/fpasoterm/User/window-state.json` に保存され、次回起動時に復元されます。保存済み size は `config.toml` に明示した `window.width`、`window.height` より優先され、CLI の一時指定は最後に適用されます。

対応する設定 section:

- `window`: 初期ウィンドウサイズ、最小ウィンドウサイズ、背景色、theme source、frame/titlebar 表示、最後の size を local に記憶するかどうか。
- `terminal`: `fontFamily`、`fontSize`、`scrollback`、`theme` などの xterm.js terminal options。
- `ime`: 二重入力 guard の `duplicateGuard`、`duplicateWindowMs`、`repeatedTextWindowMs`。
- `plugins.enabled`: config directory からの相対 plugin path。

プラグインは `~/.config/fpasoterm/User/plugins/` 配下に置きます。`.js` と `.ts` に対応します。TypeScript plugin は起動時に `~/.config/fpasoterm/User/cache/plugins/` へ変換してから renderer に読み込みます。

renderer plugin は `window.fpasotermPluginApi` から terminal、fit addon、解決済み config、diagnostics logger を利用できます。

全デフォルト設定は `docs/config.ja.md` に記載しています。設定サンプルは `examples/config/`、plugin sample は `examples/plugins/` を参照してください。

現時点の platform 制約は `docs/known-issues.ja.md` に記録します。

## 診断

`FPASOTERM_DEBUG_KEYS=1` を設定すると、key event と composition event を記録します。

診断ログは以下へ保存されます。

```text
diagnostics/fpasoterm-debug.log
```

debug panel の Copy ボタンは desktop runtime の clipboard API を使うため、xterm.js が通常のコピー操作を奪う場合でもログをコピーできます。

## 非目標

- fpasoterm は IBus engine を管理しません。
- fpasoterm は画面分割や複数 window の管理を実装しません。
- fpasoterm は OS レベルの日本語入力切替を独自実装しません。
- fpasoterm は shell の挙動を独自実装しません。shell との接続は portable-pty に任せます。
