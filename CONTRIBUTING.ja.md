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
