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

### Plugin activity の error表示を実機確認する

unit testでは正常command、例外command、未登録commandを確認します。実際のWebView上の
error panelとClose buttonは、偶発的なRDP/network errorに依存せず、意図的に例外を出す
一時local pluginで確認します。`~/.config/fpasoterm/User/plugins/plugin-activity-error-test.js`
を作成し、次の信頼できる検証用sourceだけを配置します。

```js
// @fpasoterm-plugin version: 1.0.0
// @fpasoterm-plugin description: Temporary Plugin activity error-panel test.
(() => {
  const api = window.fpasotermPluginApi;
  api.registerCommand(
    'diagnostics.plugin-activity-error',
    'Test Plugin Activity Error',
    () => {
      throw new Error('Intentional Plugin activity test error');
    },
  );
})();
```

有効化してlocal development runtimeを再起動します。

```sh
node ./bin/fpasoterm --plugin-enable plugin-activity-error-test
node ./bin/fpasoterm --dev
```

Plugin menuから **Test Plugin Activity Error** を選択します。error panelが表示されること、
**Close** でpanelが消えること、直後からterminalへkeyboard入力できることを確認してください。
確認後は一時plugin sourceと`plugins.enabled` entryをまとめて削除します。

```sh
node ./bin/fpasoterm --plugin-uninstall plugin-activity-error-test
```

このtest pluginはcommit、配布、通常利用をしません。

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
