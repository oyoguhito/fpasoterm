# 設定と診断

以下のcommandはlocal stateを参照するだけで、terminal windowを開かず、
`config.toml`も書き換えません。

## 設定

```sh
fpasoterm --config-path
fpasoterm --config-example > config.toml
fpasoterm --config-check
fpasoterm --config ~/.config/fpasoterm/User/work.toml --config-check
```

`--config-path`は選択中の`config.toml`のpathを表示します。
`--config-example`は現在のOS向けの完全な既定TOMLを標準出力へ表示します。
新規fileを作る場合だけredirectを使ってください。既存configをbackup付きで戻す場合は
`--reset-config`を使用します。

`--config-check`は選択中のTOMLを解析し、書換なしでwarningを表示します。TOML構文errorは
exit status `1`になります。warningだけの場合は、省略した設定を既定値で補えるためexit status
`0`です。正の数であるべき設定、無効または存在しない`plugins.enabled`、
`--prune-config`で削除対象となる未対応keyを確認します。

## Doctor

```sh
fpasoterm --doctor
```

`--doctor`はread-onlyです。Node launcherでは選択中のconfig検証、npmの`latest`との比較、
`npm audit --omit=dev`を実行します。自動更新やconfig書換は行わず、結果に応じて明示的な
`--self-update`だけを案内します。standalone binaryではconfigと更新確認を実行しますが、
npm package manifestを持たないためnpm auditは`unavailable`として表示します。

## 診断report

```sh
fpasoterm --diagnostics
fpasoterm --diagnostics > fpasoterm-diagnostics.md
fpasoterm --copy-diagnostics
```

`--diagnostics`はGitHub Issueへ貼り付けやすいMarkdownを表示します。version/build commit、
OS/architecture、config path/status、有効plugin、設定済みまたは保存済みterminal size、font size、
logging path、sync状態、debug log pathを含みます。plugin名やlocal pathがprivateな場合があるため、
Issueへ投稿する前に内容を確認してください。

`--copy-diagnostics`は同じMarkdownをOSのtext clipboardへ書き込みます。Windowsはnative clipboard、
macOSは`pbcopy`、Linuxは`wl-copy`、`xclip`、`xsel`を順に使います。利用可能なclipboard providerが
無い場合はerrorになります。

## Log

```sh
fpasoterm --open-log-dir
```

必要ならterminal log directoryを作成し、OSのfile managerで開いた後、pathも表示します。既定は
`~/.config/fpasoterm/User/logs`で、`[logging].directory`を設定した場合はそのdirectoryを使います。
debug logは常にlocalの`User/logs/fpasoterm-debug.log`です。

npm launcherと配布済みdirect binaryの両方で使用できます。headless環境では
`--open-log-dir`ではなく表示されたpathを使用してください。
