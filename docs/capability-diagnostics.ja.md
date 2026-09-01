# Terminal Capability Diagnostics

window menu から **Diagnostics > Capability Test** を選択します。既存の
diagnostics panelを表示するだけで、terminal session、shell設定、保存済み設定は変更しません。

panelにはfpasotermがPTYへ設定する次のenvironmentを表示します。

- `TERM`: `xterm-256color`
- `COLORTERM`: `truecolor`
- `locale`: 有効な`LC_ALL`、`LC_CTYPE`、または`LANG`
- `output encoding`: 設定済みPTY decoder
- `shell`: configまたはOS既定から選択したshell command

## Output Encoding

panelから`terminal.encoding`を`utf-8`、`shift-jis`、`euc-jp`として保存できます。
PTY decoderとshell localeはshell起動前に決まるため、選択後はwindowを再起動してください。
既定値はUTF-8です。Unixでは親環境がUTF-8以外のlocaleでも、UTF-8 PTYにはUTF-8 localeを
設定するため、通常のtoolが日本語filenameを`?`へ置換することを防ぎます。文字コードの自動判定は
曖昧で正しいtextも壊し得るため実装しません。

## Truecolor

rendererは24-bit ANSI colorを扱い、`COLORTERM=truecolor`でterminal applicationへ通知します。
panel内の次のcommandをterminalで実行し、赤・緑・青のwordがそれぞれ異なる色で表示されることを
確認してください。

```sh
printf '\033[38;2;255;80;80mred \033[38;2;80;220;140mgreen \033[38;2;90;150;255mblue\033[0m\n'
```

## Control Sequence

- **OSC 52 clipboard:** `security.osc52`が`trusted`の場合だけ受信したtext clipboard
  payloadをOS clipboardへ書き込みます。`security.osc52MaxBytes`でdecode後のsizeを制限します。
  terminal outputをtrustedできない場合は`security.osc52 = "disabled"`を設定してください。
- **OSC 7 current directory:** 受信した`file://` reportはdiagnostics metadataとして保持します。
  `Ctrl+Shift+o`または**Window > New CWD**で、OSC 7が通知したexisting local absolute directoryから別windowを開けます。
  remote hostのreportまたは存在しないpathは拒否します。報告されたpathをopen、参照、syncしません。
  fpasotermはBash promptごとにOSC 7を通知するよう設定します。ほかのshellでは、そのshell側のOSC 7 integrationが必要です。
- **OSC 133 shell integration:** promptとcommand lifecycle markerはdiagnostics metadataとしてだけ
  保持します。commandを実行したりshell、multiplexer、TUIのworkflowを置き換えたりしません。
- **OSC 8 hyperlink:** 表示されたOSC 8 linkまたは通常の`http(s)` URLをclickすると明示的な確認dialogを表示します。
  URLのcopyは常に可能です。外部browserでopenするには`security.osc8Open = true`も必要です。自動openはしません。
  absolute pathと`~/` pathはcopy-onlyです。
- **OSC 9 / OSC 99通知:** desktop notificationは既定で無効です。`security.oscNotifications = true`で有効化できます。
  最初の使用時にはOS notification permissionを確認することがあります。`security.oscNotificationMinIntervalMs`は通知間隔を
  1,000--60,000 msに制限します（既定5,000 ms）。
- **Bracketed paste:** xterm.jsがterminal inputを処理します。shellまたはTUIがDECSET 2004を有効にすると、
  paste textはbracketed sequenceとして届きます。
- **Bell:** BELはxterm.jsへ渡します。音またはvisual feedbackはOSとwebviewの設定に依存するため、
  無音の場合があります。

panelはclipboard書込み、URL open、bellを自動実行せず、対応経路を説明します。現在のterminal sessionへ
影響を与えないためです。

## 動作確認

1. fpasotermを起動し、**Diagnostics > Capability Test** を開きます。
2. `TERM`が`xterm-256color`、`COLORTERM`が`truecolor`であることを確認します。
3. 表示されたtruecolor commandを実行し、3色が異なることを確認します。
4. `printf 'https://example.com /tmp/fpasoterm-link-test\n'`を実行し、各項目をclickしてtrustedなtext fieldへpasteし、URL/pathがcopyされることを確認します。
5. TUIの挙動に問題がある場合は、このpanelの内容と`fpasoterm --diagnostics`を合わせてIssueへ記載します。
