# fpasoterm 仕様

## 目的

fpasoterm は、ChromeOS Linux での日本語入力を重視したデスクトップ Terminal アプリです。将来的に他 OS へ展開しやすい構成を採用します。screen / tmux / byobu / herdr などの terminal multiplexer と併用する前提で、画面分割はアプリ側で行いません。複数 window は titlebar の操作で並べられます。

## 構成

- Tauri がアプリケーションウィンドウと platform webview の入力メソッド経路を担当します。
- xterm.js が renderer process で Terminal UI を描画します。
- portable-pty が Rust backend で shell 付き PTY を作成します。
- renderer と backend の通信は Tauri command / event に限定します。
- terminal clipboard integration は選択した terminal text の copy、multiplexer からの OSC 52 copy request、paste shortcut の backend OS clipboard fallback 経由送信を処理します。
- terminal output logging は fpasoterm が受け取る PTY stream から一般的な terminal control sequence を除去して記録します。fpasoterm は split-pane を認識しないため、pane 単位の log は tmux、screen、byobu、herdr などの multiplexer 側に委ねます。

## ChromeOS Linux の入力方針

fpasoterm は `かな` / `英数` などの日本語キーボードキーを横取りしません。IME の切替と composition は platform webview と OS に任せます。

terminal copy は、terminal text を選択して `Ctrl+Shift+C` を押すと、その選択範囲を WebView clipboard event/API と backend clipboard 経路の両方で OS clipboard へ書き込みます。hamburger の window menu には `Log Start (^S)` / `Log Stop (^S)`、`Log Show (^P)`、`Copy (^C)`、`Paste (^V)` を表示します。`Ctrl+Shift+L` は log 操作に focus した状態でこの menu を開き、`Ctrl+Shift+S` と `Ctrl+Shift+P` は logging と log 表示を直接実行します。右クリックは terminal selection がある場合は copy、selection がない場合は paste として動作します。terminal paste は OS clipboard を backend 経由で読み取り、PTY へ送ります。herdr、tmux、screen などが OSC 52 clipboard sequence を出す設定の場合、fpasoterm はその payload を OS clipboard に書き込みます。`Ctrl+Shift+M` で window menu を開き、menu 内の `Help (^H)` または `Ctrl+Shift+H` でアプリの全 shortcut 一覧を表示します。

terminal log panel が開いている間、keyboard focus は panel 内に留まります。`Tab` と `Shift+Tab` で log selector、検索欄、操作 button、close button、log text area を循環できます。focus された control は高 contrast の outline で表示します。`Search` button は表示中の log から次の一致文字列を選択してその位置へ scroll し、現在の一致番号を表示します。`N` と `j` は次の一致、`P` と `k` は前の一致へ移動します。矢印キーは通常の text area scroll 用に残します。

npm binary 名は `fpasoterm` です。Linux では `--disable-dmabuf` により、WebKitGTK の描画診断用に `WEBKIT_DISABLE_DMABUF_RENDERER=1` を設定できます。
既定では launcher はコンソールから切り離して起動します。debug 時は `--foreground` で接続したままにできます。
`fpasoterm --list` / `fpasoterm -l` は起動中のwindowごとにprocess/session ID、表示title、起動時刻を1行で出力し、新しいwindowを開かずに終了します。

`fpasoterm --close <pid|title|all>` / `fpasoterm -q <pid|title|all>`は、新しいwindowを開かずに通常終了を要求します。数値はprocess ID、それ以外は表示titleとの完全一致で選択し、大文字小文字を区別しない予約targetの`all`は起動中の全fpasoterm windowを閉じます。確認dialogは表示しません。同じ表示titleのwindowが複数ある場合は、一致した全windowを閉じます。

npm registry から直接インストールできます。

```sh
npm install -g fpasoterm
```

展開済み checkout では、`npm run install:desktop` により `XDG_BIN_HOME` または `~/.local/bin` にローカル `fpasoterm` コマンドをインストールします。

`npm run update:desktop` は同じ command、launcher entry、hicolor icon files を上書きします。`npm run uninstall:desktop` は source checkout や npm dependencies を削除せず、インストール済みファイルだけを削除します。Windows では current user の `Path` から fpasoterm 関連 directory だけを削除し、共有 npm directory は削除しません。

プロジェクトアイコンは `extra/logo/fpasoterm.png` です。

複数の fpasoterm を起動している場合、titlebar の window menu にある
`Tile (^T)`、または `Ctrl+Shift+T` で格子状に配置できます。Windows と
X11 では native placement を使用します。Wayland compositor が位置変更を
拒否した場合は、diagnostics に要求位置と実際の位置を記録します。

起動中instanceはcache markerを定期更新します。Tileのwindow件数とtitle suffix採番では、更新が停止したmarkerを除外します。Tileは2 windowを2x1、4 windowを2x2、8 windowを4x2、9 windowを3x3、10 windowを5x2の安定したgridへ配置します。同じbase titleの追加windowは、現在起動中の最大suffixの次の番号を使います。

macOSとWindowsではapplication executable directoryをchild shellの`PATH`先頭へ追加します。macOSのfpasoterm内で`fpasoterm`を実行した場合は、新しいGUI processを切り離して現在のshell promptを解放します。

アプリケーションウィンドウはこの PNG を runtime icon として使います。Linux desktop entry は `Icon=fpasoterm` を参照するため、installer はこの画像を対象環境の icon theme へ配置します。サイズ別 hicolor PNG は `extra/linux/icons/hicolor/` に生成します。

license は MIT です。global install で `fpasoterm` コマンドを作るため、`package.json` の `bin.fpasoterm` を公開します。

shell 付き PTY が終了した場合、fpasoterm は対応するアプリケーションウィンドウを閉じます。これにより shell で `exit` を実行すると通常の Terminal ウィンドウと同じように終了します。

## 設定とプラグイン

ユーザー設定は `~/.config/fpasoterm/User/config.toml` から読み込みます。`XDG_CONFIG_HOME` がある場合は `$XDG_CONFIG_HOME/fpasoterm/User/config.toml` を使います。
`fpasoterm --config <path>` で一度だけ別の TOML file を使えます。`--width`、`--height`、`--size` は一度だけ window size を上書きします。`--shell <command>` は一度だけ別の shell を使います。`--command <command>` は起動後に shell へ command を送ります。`--reset-window-state` は保存済み window size を削除します。`--reset-config` (`-R`) は選択した `config.toml` をtimestamp付きbackup名へrenameし、OSごとの全デフォルト値へ戻し、保存済みwindow stateも削除してデフォルトの1000x680を反映して終了します。
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
~/.config/fpasoterm/User/logs/fpasoterm-debug.log
```

diagnostics / log panel の textarea も terminal selection と同じ `Ctrl+Shift+C` copy 経路を使います。

## 非目標

- fpasoterm は IBus engine を管理しません。
- fpasoterm は画面分割を実装しません。screen、tmux、byobu、herdr などを使用してください。
- fpasoterm は OS レベルの日本語入力切替を独自実装しません。
- fpasoterm は shell の挙動を独自実装しません。shell との接続は portable-pty に任せます。
