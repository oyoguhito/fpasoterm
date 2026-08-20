# インストール

英語版: [INSTALL.md](INSTALL.md)。概要と利用方法は[日本語 README](README.ja.md)を参照してください。

## npm

npm registry から公開済み package をインストールします。

```sh
npm install -g fpasoterm
fpasoterm
```

npm の自動 audit request がネットワーク上で問題になる場合、local install には `--no-audit` を使用できます。CI では repository 内の明示的な security check を継続して実行します。window を開かずに command path 上の version と build commit を確認するには次を実行します。

```sh
fpasoterm --version
fpasoterm -v
```

Windows で新しい `.exe` または `.msi` を導入した後も古い version が表示される場合、`Path`、Start menu、pinned shortcut のいずれかが古い executable を起動しています。起動中の fpasoterm window を閉じ、新しい package を再インストールしてから更新後の shortcut で起動してください。

Windows build では release executable と同じ directory に `fpasoterm.cmd` を配置します。`--version`、`--plugin-path`、`--plugin-info`などCLI専用操作にはこのconsole wrapperを使ってください。CLI操作は executable を直接実行するため、stdout、stderr、終了codeがPowerShellまたはcmdへ戻ります。通常起動は従来どおり非待機です。

```powershell
.\src-tauri\target\release\fpasoterm.cmd --version
.\src-tauri\target\release\fpasoterm.cmd --plugin-path
.\src-tauri\target\release\fpasoterm.cmd --help
.\src-tauri\target\release\fpasoterm.cmd
```

同じ wrapper から PowerShell の command completion を有効化できます。

```powershell
.\src-tauri\target\release\fpasoterm.cmd --completion powershell | Out-String | Invoke-Expression
```

Bash、Zsh、Fish、永続化方法、および `cmd.exe` の制約は[コマンド補完](docs/completion.ja.md)を参照してください。

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

checkout path、launcher icon、installed command wrapper、Rust source、renderer asset を更新した場合:

```sh
npm run update:desktop
```

この command は desktop launcher を上書きし、local runtime を再buildします。次の icon または command 起動では、更新後の checkout が使われます。

`npm run update:desktop` は Linux / ChromeOS の desktop integration 用です。Windows では desktop を変更せず終了します。Windows 版は最新の `.msi` または `.exe` artifact を install して更新してください。

npm でインストールした package を terminal から更新する場合:

```sh
fpasoterm --self-update
```

起動せずに現在使われている version を確認する場合:

```sh
fpasoterm --version
fpasoterm -v
```

Windows で新しい `.exe` または `.msi` を古い版へ上書きインストールした後も古い UI が表示される場合は、まず `fpasoterm --version` を確認してください。古い version が表示される場合、`Path`、Start menu、pinned shortcut のいずれかが古い executable を起動しています。起動中の fpasoterm を閉じ、新しい installer を再実行してから更新後の shortcut で起動してください。

source checkout の場合は、通常の git または jj workflow で checkout を更新した後、
installed command、launcher entry、icons を更新します。

```sh
fpasoterm --update-desktop
```

clean な non-jj git checkout では、次で自動化できます。

```sh
fpasoterm --self-update-checkout
```

npm global install で入れた npm 管理下の `fpasoterm` command を削除する場合:

```sh
npm uninstall -g fpasoterm
```

この操作では source checkout の desktop launcher、ユーザー設定、cache、app data は削除されません。実行後も `type -a fpasoterm` で command が表示される場合は、source checkout launcher など別の install が残っています。

Windows では PowerShell または Command Prompt で同じ command を実行できます。実行後は新しい terminal を開き、`where.exe fpasoterm` または `Get-Command fpasoterm -All` で別の command が残っていないか確認してください。

source checkout から導入した local command、desktop launcher entry、icon、ユーザー設定、runtime cache、Tauri/WebKit app data を削除する場合:

```sh
npm run uninstall:desktop
```

Windows の `npm run uninstall:desktop` は、local testing で追加した fpasoterm 関連 directory を current user の `Path` から削除するだけです。global npm package、source checkout、ユーザー設定、cache、app data は削除しません。共有 npm directory は残します。

両方を削除する場合は、source checkout 内で先に `npm run uninstall:desktop` を実行し、その後 `npm uninstall -g fpasoterm` を実行してください。

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
- Windows x64 bundle と `fpasoterm-<version>-windows-cli.cmd` console wrapper

Debian package をローカルにインストールする場合:

```sh
sudo apt install ./artifacts/fpasoterm_1.3.0_arm64-linux-arm64.deb
```

## Linux Desktop Entry

desktop entry template は次のファイルです。

```text
extra/linux/io.github.oyoguhito.fpasoterm.desktop
```

application icon の元画像は次の PNG です。

```text
extra/logo/fpasoterm.png
```

macOS app bundle では次を使います。

```text
extra/macos/fpasoterm.icns
```

Windows app bundle では次を使います。

```text
extra/windows/fpasoterm.ico
```

desktop entry と hicolor launcher icon を current user の data directory へインストールします。

```sh
npm run install:desktop
```

unpacked checkout を install する場合、desktop entry の `Exec=` は絶対 path の `~/.local/bin/fpasoterm` wrapper に書き換えられ、`TryExec` は設定しません。wrapper は install 時に使用した Node.js executable を記録し、一般的な `node` path も fallback として確認します。launcher environment に user shell の `PATH` が含まれない ChromeOS でも起動できるようにするためです。

installed desktop entry は `StartupWMClass=fpasoterm` と `Icon=io.github.oyoguhito.fpasoterm` を使います。GTK application id は無効化しているため、CLI または launcher から複数の fpasoterm window を起動できます。launcher は fpasoterm の shelf icon と hover name を解決します。installer は hicolor icon theme に `io.github.oyoguhito.fpasoterm.png` と `fpasoterm.png` の両方を配置します。

`extra/logo/fpasoterm.png` を置き換えた後は、launcher icon size を再生成します。

```sh
npm run generate:icons
npm run update:desktop
```
