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
Node launcherでのみ、結果に応じて明示的な`--self-update`を案内します。standalone binaryでは
configと更新確認を実行しますが、`--self-update`は利用できません。更新がある場合はGitHub
Releaseのdownload pageを案内します。npm package manifestを持たないためnpm auditは
`unavailable`として表示します。

LinuxのNode launcherでは、利用可能なnative runtimeに対して`ldd`によるread-onlyの共有library確認も行います。GUIのみの起動でWebKitGTKをloadできない場合、`--doctor`は不足libraryとDebian/Ubuntu/ChromeOS向けの明示的な復旧commandを表示します。fpasoterm自身がOS packageを導入することはありません。windowを開く前に不足を検出したdesktop起動では、同じ結果を`~/.cache/fpasoterm/launcher.log`へ記録し、可能な場合はdesktop notificationも表示します。

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
Linuxでは`--doctor`と同じnative runtime依存関係のread-only確認も含まれます。

`--copy-diagnostics`は同じMarkdownをOSのtext clipboardへ書き込みます。Windowsはnative clipboard、
macOSは`pbcopy`、Linuxは`wl-copy`、`xclip`、`xsel`を順に使います。利用可能なclipboard providerが
無い場合はerrorになります。

## window内Diagnosticsとterminal recordingの違い

window menuの**Diagnostics Log**は、fpasotermのruntime event（renderer、input、plugin、
graphics receiverなど）をその場で確認するための、上限付きlive viewです。terminal paneの全文ではなく、
file recorderでもありません。event traceが必要なときは`--debug-keys`または
`--console-diagnostics`を付けて起動してください。viewが保持するのは、そのwindowで最大1,000行です。

- **Freeze display**は、検索・copyできるよう現在の表示だけを固定します。収集は**止まりません**。
  後から届くruntime eventもmemory内には保存されます。**Show live**で最新表示へ戻ります。
- **Erase saved diagnostics**は、そのwindowのmemory内履歴を消去してlive表示へ戻します。永続debug fileは消しません。
- **Copy saved diagnostics**は、search filterで隠れている行も含むmemory内履歴をcopyします。

これに対し**Log Start** / **Log Stop**は、設定済みlogging directoryへ保存するterminal-output
recording fileの開始・終了です。file recordingの期間を選ぶためstart/stopがあります。Diagnosticsの
producerは起動時のdebug optionで有効化するため、同じstart/stopはありません。表示をfreezeしても
recordingを停止する操作にはなりません。

Herdrなどのmultiplexerを使用する場合、fpasotermが観測できるのはHerdrが外側PTYへ実際に転送した
byteとgraphics eventだけです。Diagnosticsやterminal logから、child paneの完全なtranscriptを得ること、
byteごとのpane特定、Herdr内でcontrol sequenceが消費されたかの証明はできません。Kittyの問題では
application自身のsender reportも使用してください（`fpasobrowser --debug`後に`d` / `D` / `C`）。
これはfpasobrowserが何を送出したかは確認できますが、Herdrまたはreceiverが描画したとは主張しません。

## Log

```sh
fpasoterm --open-log-dir
```

必要ならterminal log directoryを作成し、OSのfile managerで開いた後、pathも表示します。既定は
`~/.config/fpasoterm/User/logs`で、`[logging].directory`を設定した場合はそのdirectoryを使います。
debug logは常にlocalの`User/logs/fpasoterm-debug.log`です。

npm launcherと配布済みdirect binaryの両方で使用できます。headless環境では
`--open-log-dir`ではなく表示されたpathを使用してください。
