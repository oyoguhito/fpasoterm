# Terminal Capability Diagnostics

window menu から **Diagnostics > Capability Test** を選択します。既存の
diagnostics panelを表示するだけで、terminal session、shell設定、保存済み設定は変更しません。

panelにはfpasotermがPTYへ設定する次のenvironmentを表示します。

- `TERM`: `xterm-256color`
- `COLORTERM`: `truecolor`
- `locale`: 有効な`LC_ALL`、`LC_CTYPE`、または`LANG`
- `shell`: configまたはOS既定から選択したshell command

## Truecolor

rendererは24-bit ANSI colorを扱い、`COLORTERM=truecolor`でterminal applicationへ通知します。
panel内の次のcommandをterminalで実行し、赤・緑・青のwordがそれぞれ異なる色で表示されることを
確認してください。

```sh
printf '\033[38;2;255;80;80mred \033[38;2;80;220;140mgreen \033[38;2;90;150;255mblue\033[0m\n'
```

## Control Sequence

- **OSC 52 clipboard:** 受信したtext clipboard payloadをOS clipboardへ書き込みます。tmux、screen、
  byobu、herdrなどtrustedなlocal toolでの使用を想定しています。
- **OSC 8 hyperlink:** sequenceはxterm.jsへ渡します。link表示とopen動作はplatform webviewに依存する
  ため、security boundaryとしては扱わないでください。
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
4. TUIの挙動に問題がある場合は、このpanelの内容と`fpasoterm --diagnostics`を合わせてIssueへ記載します。
