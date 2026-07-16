# fpasoterm

![fpasoterm logo](extra/logo/fpasoterm.png)

Cross-platform terminal app built with Tauri, xterm.js, and a Rust PTY bridge.

fpasoterm is intended to be used with terminal multiplexers such as screen / tmux / byobu / herdr. It focuses on a single terminal surface and does not plan to manage split panes or multiple windows itself.

日本語の概要は [日本語](#日本語) を参照してください。

- Tauri provides the application shell through the platform webview.
- xterm.js renders the terminal in the renderer process.
- Rust and portable-pty own the real shell/PTY in the backend process.

Japanese IME composition and keyboard layout switching are handled by the OS webview and xterm.js. fpasoterm does not intercept `かな` / `英数` key presses.

Set `FPASOTERM_DEBUG_KEYS=1` to print runtime key names to stderr and show the latest key/composition event in the window while testing Japanese keyboard keys.

Debug logs are also written to `diagnostics/fpasoterm-debug.log`. The debug panel has a Copy button because xterm.js can capture normal terminal copy shortcuts.

On Linux, Tauri uses WebKitGTK. If ChromeOS/Baguette shows black, white, or flickering surfaces while testing transparent windows, disable the DMA-BUF renderer for that launch:

```sh
fpasoterm --disable-dmabuf
```

## Requirements

Detailed installation instructions are in [INSTALL.md](INSTALL.md).

For local ChromeOS Linux development:

```sh
sudo apt install build-essential curl libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

Node.js and Rust are managed by mise in this workspace. You can also use system installations.

## Run

```sh
npm install
./scripts/run
```

For quick source-checking without rebuilding release bundles:

```sh
./bin/fpasoterm --dev
```

Use this after editing renderer or Tauri source. It ignores any stale `src-tauri/target/release/fpasoterm` binary.
Add `--foreground --console-diagnostics` only when you need logs in the current console.

With mise:

```sh
mise exec node -- npm install
mise exec node -- npm start
```

To install a local command and launcher entry for this checkout:

```sh
npm run install:desktop
fpasoterm
```

The command is installed to `~/.local/bin/fpasoterm` by default. Set `XDG_BIN_HOME` to choose a different command directory.

To update the local command, launcher entry, and icons after pulling a newer checkout:

```sh
npm run update:desktop
```

To cleanly remove the local command, launcher entry, and installed launcher icons:

```sh
npm run uninstall:desktop
```

## Command-line binary

Install from the npm registry:

```sh
npm install -g fpasoterm
fpasoterm
```

The npm package name and command are both `fpasoterm`.

During development, link the package to expose a `fpasoterm` command:

```sh
npm link
fpasoterm
```

Alternatively:

```sh
npm install -g .
fpasoterm
```

When the shell exits, for example by running `exit`, fpasoterm closes the application window.

## Command-line Options

Normal launches detach from the console and return the shell prompt immediately:

```sh
fpasoterm
```

Show available options:

```sh
fpasoterm --help
```

Useful one-shot overrides:

```sh
fpasoterm --config ~/.config/fpasoterm/User/work.toml
fpasoterm --size 1200x760
fpasoterm --width 1200 --height 760
fpasoterm --shell pwsh.exe
fpasoterm --command "tmux attach -t work"
fpasoterm --title work --titlebar-color '#2e7d32'
fpasoterm --reset-window-state
```

Short options are available for common one-shot overrides:

```sh
fpasoterm -t work -b '#2e7d32' -z 1200x760 -s pwsh.exe
fpasoterm -e "tmux attach -t work"
```

Inspect the resolved settings and plugin load status without launching:

```sh
fpasoterm --show-config
fpasoterm --config ~/.config/fpasoterm/User/work.toml --show-config
```

Enable or disable plugins in `config.toml`:

```sh
fpasoterm --enable-plugin hello.ts,theme.ts
fpasoterm --disable-plugin hello.ts,theme.ts
```

For debugging, keep the app attached to the current console:

```sh
fpasoterm --foreground --console-diagnostics
```

In a source checkout, force the Tauri dev runtime when you only want to confirm behavior and do not want to rebuild bundles. Omit `--foreground` when you want the shell prompt back after launch:

```sh
./bin/fpasoterm --dev
```

For ChromeOS/Baguette WebKitGTK rendering diagnostics:

```sh
fpasoterm --disable-dmabuf
```

## Configuration and Plugins

fpasoterm reads user configuration from:

```text
~/.config/fpasoterm/User/config.toml
```

On launch, fpasoterm writes or refreshes the example file at:

```text
~/.config/fpasoterm/User/config.toml.example
```

The example file is safe to regenerate because fpasoterm does not overwrite `config.toml`.

Example:

```toml
[window]
rememberBounds = true
frame = false
[terminal]
fontSize = 15
fontFamily = "Noto Sans Mono CJK JP, monospace"

[terminal.theme]
background = "rgba(16, 19, 23, 0.80)"
foreground = "#e8edf2"

[ime]
duplicateGuard = true
duplicateWindowMs = 800
repeatedTextWindowMs = 140

[plugins]
enabled = ["plugins/example.ts"]
```

Plugins must live under `~/.config/fpasoterm/User/plugins/`. JavaScript (`.js`) and TypeScript (`.ts`) plugins are supported. TypeScript plugins are transpiled into `~/.config/fpasoterm/User/cache/plugins/` at launch.

Minimal TypeScript plugin:

```ts
/// <reference path="/path/to/fpasoterm/docs/fpasoterm-plugin.d.ts" />

const api = window.fpasotermPluginApi;
api.log('example plugin loaded');
api.terminal.options.cursorBlink = true;
```

The IME duplicate guard can be adjusted from `config.toml`. If a specific environment still produces duplicate text, increase `ime.duplicateWindowMs` or `ime.repeatedTextWindowMs` slightly.

When `window.rememberBounds` is enabled, fpasoterm stores the last window size locally in `~/.config/fpasoterm/User/window-state.json`.

Window appearance and size are resolved in this order: default settings, explicit values in `config.toml`, saved `window-state.json` for size, then one-shot CLI overrides such as `--title`, `--titlebar-color`, and `--size`.

To return to the configured or default size manually, set `window.rememberBounds = false`, or run:

```sh
fpasoterm --reset-window-state
```

The full default configuration and plugin setup are documented in [Configuration](docs/config.en.md). Sample configs are available in [examples/config](examples/config), and sample TypeScript plugins are available in [examples/plugins](examples/plugins).

Current platform limitations are tracked in [Known Issues](docs/known-issues.en.md) / [既知課題](docs/known-issues.ja.md).

## Icon

The project icon is a PNG asset:

```text
extra/logo/fpasoterm.png
```

The desktop entry uses `Icon=fpasoterm`; ChromeOS/Linux launchers resolve that name through the hicolor icon theme files under:

```text
extra/linux/icons/hicolor/
```

When packaging a macOS `.app` bundle, use the generated icon at:

```text
extra/macos/fpasoterm.icns
```

On Windows, the app window uses the generated icon at:

```text
extra/windows/fpasoterm.ico
```

To replace the icon, update `extra/logo/fpasoterm.png`, regenerate the launcher sizes, and reinstall the desktop entry:

```sh
npm run generate:icons
npm run update:desktop
```

For Android-native packaging, use the same PNG as the source asset for the Android adaptive icon pipeline.

## License

MIT. See [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Release history is tracked in [CHANGELOG.md](CHANGELOG.md).

## Project Name

The jj bookmark `main` points at an empty initial commit. The app implementation lives in the child change named `Initial fpasoterm terminal app`.

## jj Repository Initialization

```sh
cd fpasoterm
./scripts/init-jj-empty-main
```

The script creates an empty `main` branch first, then records the initial project files on top of it.

## Checks

```sh
npm run check
npm run scan:secrets
desktop-file-validate extra/linux/io.github.oyoguhito.fpasoterm.desktop
npm run audit:prod
```

GitHub Actions runs the same check set on pushes and pull requests.

## Documentation

- [Specification](docs/spec.en.md)
- [Configuration](docs/config.en.md)
- [Release checklist](docs/release-checklist.en.md)
- [仕様](docs/spec.ja.md)
- [設定](docs/config.ja.md)
- [リリースチェックリスト](docs/release-checklist.ja.md)

## 日本語

fpasoterm は Tauri、xterm.js、Rust PTY bridge を使った Terminal アプリです。ChromeOS Linux での日本語入力を重視しつつ、将来的に他 OS へ展開しやすい構成にしています。

screen / tmux / byobu / herdr などの terminal multiplexer と併用する前提です。fpasoterm 自身で画面分割や複数 window の管理は行いません。

fpasoterm は `かな` / `英数` キーを横取りしません。日本語入力の切替と composition は OS webview と xterm.js に任せます。

起動:

```sh
npm install
./scripts/run
```

リリース用 bundle を作らず、まず起動だけ確認する場合:

```sh
./bin/fpasoterm --dev
```

この起動方法は古い `src-tauri/target/release/fpasoterm` が存在していても無視し、Tauri dev runtime で現在のソースを使います。
現在のコンソールでログを見たい場合だけ `--foreground --console-diagnostics` を追加してください。

shell で `exit` を実行すると fpasoterm のウィンドウも閉じます。

## コマンドラインオプション

通常起動ではコンソールから切り離して起動し、すぐに shell prompt が戻ります。

```sh
fpasoterm
```

オプション一覧:

```sh
fpasoterm --help
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

起動せずに解決済み設定と plugin 読み込み状況を確認:

```sh
fpasoterm --show-config
fpasoterm --config ~/.config/fpasoterm/User/work.toml --show-config
```

`config.toml` の plugin を有効化・無効化:

```sh
fpasoterm --enable-plugin hello.ts,theme.ts
fpasoterm --disable-plugin hello.ts,theme.ts
```

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
fontFamily = "Noto Sans Mono CJK JP, monospace"

[ime]
duplicateGuard = true
duplicateWindowMs = 800
repeatedTextWindowMs = 140

[plugins]
enabled = ["plugins/example.ts"]
```

プラグインは `~/.config/fpasoterm/User/plugins/` 配下に置きます。JavaScript (`.js`) と TypeScript (`.ts`) に対応しています。TypeScript plugin は起動時に `~/.config/fpasoterm/User/cache/plugins/` へ変換されます。

最小の TypeScript plugin:

```ts
/// <reference path="/path/to/fpasoterm/docs/fpasoterm-plugin.d.ts" />

const api = window.fpasotermPluginApi;
api.log('example plugin loaded');
api.terminal.options.cursorBlink = true;
```

二重入力が残る環境では、`config.toml` の `ime.duplicateWindowMs` または `ime.repeatedTextWindowMs` を少し大きくしてください。

全デフォルト設定と plugin 設定は [設定](docs/config.ja.md) にまとめています。設定サンプルは [examples/config](examples/config)、TypeScript plugin のサンプルは [examples/plugins](examples/plugins) にあります。

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
cat diagnostics/fpasoterm-debug.log
```

アイコンを変更する場合は `extra/logo/fpasoterm.png` を差し替え、以下を実行します。

```sh
npm run generate:icons
npm run install:desktop
```

ChromeOS Linux launcher は `extra/linux/icons/hicolor/` に生成されるサイズ別 PNG を使います。Android native package を作る場合は、この PNG を adaptive icon の元画像として使います。
