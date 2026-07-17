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

Update an npm-installed package from the terminal:

```sh
fpasoterm --self-update
```

For a source checkout, update the checkout with your normal git or jj workflow,
then refresh the installed command, launcher entry, and icons:

```sh
fpasoterm --update-desktop
```

For a clean non-jj git checkout, this can be automated:

```sh
fpasoterm --self-update-checkout
```

Run `npm run update:desktop` after changing the checkout path, launcher icon, or installed command wrapper. It is not required for `./bin/fpasoterm --dev ...`.

Remove the local command, launcher entry, installed launcher icons, user config,
runtime cache, and Tauri/WebKit app data:

```sh
npm run uninstall:desktop
```

On Windows, this also removes fpasoterm-specific directories from the current
user's `Path` if they were added during local testing. Shared npm directories
are left untouched.

To expose the local command during development:

```sh
npm link
fpasoterm
```

If ChromeOS/Baguette shows black, white, or flickering surfaces during transparency testing, start with:

```sh
fpasoterm --disable-dmabuf
```

## Release Artifacts

To create artifacts for the current development machine:

```sh
npm run build:artifacts
```

Generated files are written to `artifacts/`. Source archives are always generated. Platform bundles depend on the current OS, so a local Linux build creates Linux packages only.

Tagged GitHub Releases build the broader release set in GitHub Actions:

- source package and portable source archive
- Linux x64 `.deb` / `.rpm`
- Linux arm64 `.deb` / `.rpm` for ChromeOS/Baguette and other arm64 Linux environments
- macOS x64 bundle
- macOS arm64 bundle
- Windows x64 bundle

Install the Debian package locally:

```sh
sudo apt install ./artifacts/fpasoterm_1.2.2_arm64-linux-arm64.deb
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

npm でインストールした package を terminal から更新する場合:

```sh
fpasoterm --self-update
```

source checkout の場合は、通常の git または jj workflow で checkout を更新した後、
installed command、launcher entry、icons を更新します。

```sh
fpasoterm --update-desktop
```

clean な non-jj git checkout では、次で自動化できます。

```sh
fpasoterm --self-update-checkout
```

local command、launcher entry、icon、ユーザー設定、runtime cache、Tauri/WebKit app data を完全に削除する場合:

```sh
npm run uninstall:desktop
```

Windows では、local testing で追加した fpasoterm 関連 directory を current user
の `Path` から削除します。共有 npm directory は残します。

ChromeOS/Baguette で透過検証中に黒、白、ちらつきが出る場合:

```sh
fpasoterm --disable-dmabuf
```

## リリース成果物

現在の開発環境向けの成果物を作る場合:

```sh
npm run build:artifacts
```

生成物は `artifacts/` に出力されます。source archive は常に生成されます。platform bundle は現在の OS 向けだけなので、Linux のローカルビルドでは Linux package だけが生成されます。

tag 付きの GitHub Release では、GitHub Actions で次の成果物を作成します。

- source package と portable source archive
- Linux x64 `.deb` / `.rpm`
- ChromeOS/Baguette を含む arm64 Linux 向け `.deb` / `.rpm`
- macOS x64 bundle
- macOS arm64 bundle
- Windows x64 bundle

Debian package をローカルにインストールする場合:

```sh
sudo apt install ./artifacts/fpasoterm_1.2.2_arm64-linux-arm64.deb
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

For unpacked checkout installs, the installed desktop entry rewrites `Exec=` to
the absolute `~/.local/bin/fpasoterm` wrapper path and does not set `TryExec`.
The wrapper records the Node.js executable used during installation and also
falls back to common `node` paths. This avoids ChromeOS launcher failures when
the launcher environment does not include the user's shell `PATH`.

Regenerate launcher icon sizes after replacing `extra/logo/fpasoterm.png`:

```sh
npm run generate:icons
npm run update:desktop
```
