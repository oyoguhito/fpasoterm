# FpasoTerm 仕様

## 目的

FpasoTerm は、ChromeOS Linux での日本語入力を重視したデスクトップ Terminal アプリです。将来的に他 OS へ展開しやすい構成を採用します。

## 構成

- デスクトップ runtime がアプリケーションウィンドウと Chromium の入力メソッド経路を担当します。
- xterm.js が renderer process で Terminal UI を描画します。
- node-pty が main process で shell 付き PTY を作成します。
- renderer と main process の通信は preload IPC API に限定します。

## ChromeOS Linux の入力方針

FpasoTerm は `かな` / `英数` などの日本語キーボードキーを横取りしません。IME の切替と composition は Chromium と OS に任せます。

Linux では Chromium Ozone の初期化に間に合うよう、既定で次の switch を付けて起動します。

```text
--ozone-platform=x11
```

そのため Linux では `--ozone-platform=x11` を既定で付けて起動します。上書きも可能です。

```sh
FPASOTERM_OZONE_PLATFORM=wayland fpasoterm
```

npm binary 名は `fpasoterm` です。この binary は Chromium の switch を app path より前に渡すため、Ozone 初期化に間に合います。

npm registry から直接インストールできます。

```sh
npm install -g fpasoterm
```

展開済み checkout では、`npm run install:desktop` により `XDG_BIN_HOME` または `~/.local/bin` にローカル `fpasoterm` コマンドをインストールします。

`npm run update:desktop` は同じ command、launcher entry、hicolor icon files を上書きします。`npm run uninstall:desktop` は source checkout や npm dependencies を削除せず、インストール済みファイルだけを削除します。

プロジェクトアイコンは `extra/logo/fpasoterm.png` です。

アプリケーションウィンドウはこの PNG を runtime icon として使います。Linux desktop entry は `Icon=fpasoterm` を参照するため、installer はこの画像を対象環境の icon theme へ配置します。サイズ別 hicolor PNG は `extra/linux/icons/hicolor/` に生成します。

license は MIT です。global install で `fpasoterm` コマンドを作るため、`package.json` の `bin.fpasoterm` を公開します。

shell 付き PTY が終了した場合、FpasoTerm は対応するアプリケーションウィンドウを閉じます。これにより shell で `exit` を実行すると通常の Terminal ウィンドウと同じように終了します。

## 診断

`FPASOTERM_DEBUG_KEYS=1` を設定すると、key event と composition event を記録します。

診断ログは以下へ保存されます。

```text
diagnostics/fpasoterm-debug.log
```

debug panel の Copy ボタンは desktop runtime の clipboard API を使うため、xterm.js が通常のコピー操作を奪う場合でもログをコピーできます。

## 非目標

- FpasoTerm は IBus engine を管理しません。
- FpasoTerm は OS レベルの日本語入力切替を独自実装しません。
- FpasoTerm は shell の挙動を独自実装しません。shell との接続は node-pty に任せます。
