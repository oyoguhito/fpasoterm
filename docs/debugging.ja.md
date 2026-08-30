# デバッグガイド

IME composition、clipboard、terminal描画、window lifecycleなど、OS固有の問題を
event traceで確認する場合に使用します。

## 現在のsourceから起動する

既存のfpasoterm windowをすべて閉じてから、local debug binaryを強制rebuildします。
古いpackage済みbinaryやcached runtimeを検証しないためです。

```sh
mise exec node -- ./bin/fpasoterm --dev --foreground --debug-keys --console-diagnostics \
  2>&1 | tee ~/temp/fpasoterm-debug.log
```

`--dev`は現在のsourceからlocal debug binaryをrebuildします。`--foreground`は
launcherをconsoleへ接続したままにします。`--debug-keys`はrendererのkey/composition
diagnosticを有効化し、`--console-diagnostics`はそれをstderrにも出力します。

rebuildを強制せず、console接続だけ必要な場合は以下を使います。

```sh
fpasoterm --foreground --debug-keys --console-diagnostics
```

永続debug logは通常
`~/.config/fpasoterm/User/logs/fpasoterm-debug.log`です。OSごとに別のUser directoryを
設定している場合はその配下を確認してください。

## IME Composition Trace

少なくとも二回の変換を行って再現します。例として、`日本語は`を変換・確定した後、
別の文字列を変換・確定するか、句読点を入力します。appを閉じた後、IMEとPTY入力だけを
抜き出します。

```sh
grep -E 'renderer ime (compositionstart|compositionupdate|compositionend|beforeinput|input|keydown|cleared)|renderer terminal input' \
  ~/temp/fpasoterm-debug.log
```

期待する動作では、各`renderer terminal input`のpayloadはその回に確定したtextだけです。
ChromeOSの調査では、`compositionstart`のhelper textarea `value=`と直後の
`compositionupdate`を比較します。新しいcompositionが以前のvalueを継承してはいけません。

成功した一回と失敗した一回を含む、最小限で連続したtraceを共有してください。event payloadの
編集や置換はしないでください。eventの順序がplatform webviewとxterm.jsの相互作用を調べる
根拠になります。

## 描画とWindowの診断

ChromeOS/BaguetteでWebKitGTKの描画に問題がある場合は以下を使用します。

```sh
fpasoterm --disable-dmabuf --foreground --console-diagnostics
```

glyph、terminfo、truecolor、OSC、bracketed paste、bellの問題は報告前にtitlebar menuの
**Diagnostics > Font / Glyph Test**と**Diagnostics > Capability Test**を実行してください。
[設定と診断](diagnostics.ja.md)、[Font / Glyph Diagnostics](font-diagnostics.ja.md)、
[Terminal Capability Diagnostics](capability-diagnostics.ja.md)も参照してください。

## 安全な報告

必要に応じて`fpasoterm --diagnostics`の結果を添付しますが、先に内容を確認してください。
local path、plugin名、shell出力、sync folder情報が含まれる場合があります。credential、token、
private command、secretを含むterminal outputは公開しないでください。
