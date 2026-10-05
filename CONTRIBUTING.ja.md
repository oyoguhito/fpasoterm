# コントリビュート

fpasotermの改善に協力していただきありがとうございます。

英語版は[CONTRIBUTING.md](CONTRIBUTING.md)です。

## 開発

以下のcommandを実行する前に、Node.js 22以降、Rust stable、対象OSのnative build prerequisiteを
installしてください。

- Linux: `libgtk-3-dev`、`libwebkit2gtk-4.1-dev`、
  `libayatana-appindicator3-dev`、`librsvg2-dev`
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Visual Studio Build Toolsの **Desktop development with C++** と
  Microsoft Edge WebView2 Runtime

Debian、Ubuntu、ChromeOS Linuxでは、Linux用prerequisiteを次でinstallします。

```sh
sudo apt-get install -y build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

`libwebkit2gtk-4.1-dev` は、Tauriが必要とする`libsoup-3.0`と
`javascriptcoregtk-4.1`のpkg-config metadataを提供します。Cargoが
`soup3-sys`または`javascriptcore-rs-sys`のlibraryを発見できないと表示した場合は、
上記packageを導入します。意図的に標準外のlibrary install先を使用していない限り、
`PKG_CONFIG_PATH`を設定する必要はありません。次で確認できます。

```sh
pkg-config --modversion libsoup-3.0 javascriptcoregtk-4.1
```

```sh
npm ci
npm run check
node ./bin/fpasoterm --dev
```

Windows PowerShellではbackslashを使います。

```powershell
node .\bin\fpasoterm --dev
```

通常のlauncher起動はすぐshell promptへ戻り、cached runtimeの使用またはCargo buildの開始を
表示します。compilerとdesktop processの出力を待つ必要がある場合だけ
`--foreground --console-diagnostics`を使用してください。

IME、描画、clipboard、window問題を再現・報告する場合は、
[デバッグガイド](docs/debugging.ja.md)の強制rebuild、event trace、秘匿情報確認の手順を
使用してください。

### Plugin activity UIを実機確認する

unit testでは正常command、例外command、未登録commandを確認します。実際のWebView上の
表示は、偶発的なRDP/network errorに依存せず、同梱済みの
`examples/plugins/plugin-activity-test.ts`で繰り返し確認します。一時pluginを手作業で
作成せず、信頼するlocal plugin directoryへinstallして有効化し、local development runtimeを
再起動します。

```sh
node ./bin/fpasoterm --plugin-install-file examples/plugins/plugin-activity-test.ts --enable
node ./bin/fpasoterm --dev
```

最初にPlugin menuから **Test Plugin Activity Success** を選択します。terminalへ完了行を
書き込み、terminal focusへ戻ることが正常系の確認です。次に
**Test Plugin Activity Error** を選択します。error panelが表示されること、**Close** で
panelが消えること、直後からterminalへkeyboard入力できることを確認してください。確認後は
install済みexampleを削除します。

```sh
node ./bin/fpasoterm --plugin-uninstall plugin-activity-test.ts
```

このexampleは開発検証用としてcommitされていますが、end-user設定で通常有効化したままに
しないでください。

### Kitty graphicsとterminal-browserを実機確認する

`npm run check`には、PNG decode、古い非同期frameの破棄、reset後に完了したdecode結果を
表示・terminalへ応答しないことを含むbounded Kitty rendererのunit testがあります。
実WebViewではterminal-browserを起動し、初期描画、連続frame、window resize、titlebar zoom、
`Ctrl+Q`後のshell復帰とzoom control消去を確認してください。

Herdr paneを経由する試験では、`HERDR_PANE_ID`が空でないことと、Herdr設定の
`[terminal] kitty_graphics = true`が反映済みであることも確認します。この設定は
HerdrがKitty sequenceを外側のfpasotermへ渡すためのもので、fpasoterm自身の設定ではありません。
詳細は[設定ガイドのTerminal Graphics](docs/config.ja.md#terminal-graphics)を参照してください。

## Pull Requestの確認

Pull Request内の変更を確認する場合、tagged release assetではなくPR revisionをcheckoutして
対象OSでbuildし、Node launcherから起動してください。

```sh
gh pr checkout <number> --repo oyoguhito/fpasoterm
npm ci
npm run check
node ./bin/fpasoterm
```

Windows MSI/direct binaryとmacOS app bundleの詳細な手順は
[docs/pr-review.ja.md](docs/pr-review.ja.md)を参照してください。英語版は
[docs/pr-review.en.md](docs/pr-review.en.md)です。

変更を提出する前に以下を実行してください。

```sh
npm run check
npm run scan:secrets
desktop-file-validate extra/linux/io.github.oyoguhito.fpasoterm.desktop
npm run build:artifacts
```

## 責務境界

- terminal renderingはxterm.js、shell integrationはbackend PTYへ委ねます。
- IME切替はplatform webviewとOSへ委ねます。
- user-facing behaviorを変更する場合、公開documentationは英語と日本語の両方を更新します。
