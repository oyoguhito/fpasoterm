# Installation

## npm

After the package is published, install the command from the npm registry:

```sh
npm install -g fpasoterm
fpasoterm
```

If your network makes npm's automatic audit request noisy, use `--no-audit` for local installs. CI still runs the explicit security checks in this repository.

## Development Build

Linux development requires the Tauri/WebKitGTK system packages:

```sh
sudo apt install build-essential curl libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

```sh
npm install
./scripts/run
```

For quick behavior checks while developing, use the Tauri dev runtime:

```sh
./bin/fpasoterm --dev
```

This does not create release bundles. It also ignores an existing `src-tauri/target/release/fpasoterm`, so renderer and Tauri source changes are reflected without reinstalling the desktop entry.
Add `--foreground --console-diagnostics` only when you need logs in the current console.
The first `--dev` launch may still take a few minutes because Cargo has to create the Tauri debug binary. Later launches reuse that build cache.

Install a local `fpasoterm` command for this checkout:

```sh
npm run install:desktop
fpasoterm
```

The command is written to `~/.local/bin/fpasoterm` unless `XDG_BIN_HOME` is set.

Update an existing local command, launcher entry, and icon installation:

```sh
npm run update:desktop
```

Run `npm run update:desktop` after changing the checkout path, launcher icon, or installed command wrapper. It is not required for `./bin/fpasoterm --dev ...`.

Remove the local command, launcher entry, and installed launcher icons:

```sh
npm run uninstall:desktop
```

To expose the local command during development:

```sh
npm link
fpasoterm
```

If ChromeOS/Baguette shows black, white, or flickering surfaces during transparency testing, start with:

```sh
fpasoterm --disable-dmabuf
```

## Release Bundles

To create installable Linux bundles:

```sh
npm run build:artifacts
```

Generated files are written to `artifacts/`, including `.deb`, `.rpm`, the npm-style source package, and the portable source archive on Linux.

Install the Debian package locally:

```sh
sudo apt install ./artifacts/fpasoterm_1.0.0_arm64.deb
```

## 日本語

## 開発用の起動

Linux では Tauri/WebKitGTK の開発用 package が必要です。

```sh
sudo apt install build-essential curl libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

依存関係を入れた後、通常の開発起動は次の通りです。

```sh
npm install
./scripts/run
```

リリース用 bundle を作らず、まず起動だけ確認する場合は次を使ってください。

```sh
./bin/fpasoterm --dev
```

`--dev` は既存の `src-tauri/target/release/fpasoterm` を無視して、現在のソースを Tauri dev runtime で起動します。renderer や Tauri source の修正確認では、毎回再インストールする必要はありません。
現在のコンソールでログを見たい場合だけ `--foreground --console-diagnostics` を追加してください。
初回の `--dev` 起動では Cargo が Tauri debug binary を作るため数分かかることがあります。2回目以降は build cache を使うため短くなります。

## ローカルコマンドの更新

checkout の `fpasoterm` コマンドと launcher entry をインストールする場合:

```sh
npm run install:desktop
fpasoterm
```

checkout path、launcher icon、installed command wrapper を更新した場合:

```sh
npm run update:desktop
```

完全に削除する場合:

```sh
npm run uninstall:desktop
```

ChromeOS/Baguette で透過検証中に黒、白、ちらつきが出る場合:

```sh
fpasoterm --disable-dmabuf
```

## リリース用 bundle

Linux の installable bundle を作る場合:

```sh
npm run build:artifacts
```

生成物は `artifacts/` に出力されます。Linux では `.deb`、`.rpm`、npm 形式の source package、portable source archive が生成されます。

Debian package をローカルにインストールする場合:

```sh
sudo apt install ./artifacts/fpasoterm_1.0.0_arm64.deb
```

## Linux Desktop Entry

The desktop entry template is:

```text
extra/linux/io.github.oyoguhito.fpasoterm.desktop
```

The application icon is:

```text
extra/logo/fpasoterm.png
```

For macOS app bundles, use:

```text
extra/macos/fpasoterm.icns
```

For Windows app bundles, use:

```text
extra/windows/fpasoterm.ico
```

Install the desktop entry and hicolor launcher icons into the current user's data directory:

```sh
npm run install:desktop
```

Regenerate launcher icon sizes after replacing `extra/logo/fpasoterm.png`:

```sh
npm run generate:icons
npm run update:desktop
```
