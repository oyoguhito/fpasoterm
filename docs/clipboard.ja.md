# Clipboard のフローと検証表

この文書は ChromeOS Linux/Crostini で実際に確認した clipboard 経路と結果を記録します。すべての desktop が一つの clipboard を共有している、という前提の仕様書ではありません。

## 責務と経路

| component | Copy の責務 | Paste の責務 |
| --- | --- | --- |
| fpasoterm | `Ctrl+Shift+c`、Copy menu、terminal selection を WebView と native backend の経路で書き込みます。 | `Ctrl+Shift+v`、Paste menu、右click Paste が desktop clipboard を読んで PTY へ送ります。 |
| herdr（local Linux session） | copy mode と mouse selection は、`wl-copy --type text/plain;charset=utf-8`、利用できない場合は `xclip` / `xsel` を直接使います。 | herdr 独自の pane paste buffer shortcut はありません。fpasoterm の `Ctrl+Shift+v` 等、terminal/OS の Paste が OS clipboard を読み、herdr pane に入力します。 |
| desktop application | 通常の OS clipboard integration で copy します。 | 通常の OS clipboard integration で paste します。 |
| OSC 52 | terminal output が clipboard write を要求する経路です。trusted な remote/headless session に関係します。 | local herdr copy の通常経路ではありません。 |

Crostini では WebView/ChromeOS の shared clipboard、Wayland clipboard、X11
selection owner が一時的に異なる値を持つことがあります。一つの application で
paste に成功しても、すべての reader が同じ最新値を読むとは限りません。

## 現在確認済みの ChromeOS Linux 結果

各行は `FPA-001`、`HERDR-002`、`EXT-003` のような、他と重複しない安全な marker で検証します。password、token、private text は使用しません。

| Copy 元 | Paste 先 | 結果 | 状態 |
| --- | --- | --- | --- |
| fpasoterm の copy | fpasoterm の paste | 最新の fpasoterm 値が paste される。使用した shortcut/menu 操作は次回記録する。 | 最新の再検証で OK |
| fpasoterm selection の `Ctrl+Shift+c` | 他 desktop application | 最新の fpasoterm 値が paste される。 | 最新の再検証で OK |
| 他 desktop application | fpasoterm の `Ctrl+Shift+v` | 最新の外部 application 値が paste される。 | 最新の再検証で OK |
| 他 desktop application | herdr の `Ctrl+Shift+v` | 最新の外部 application 値が paste される。 | 最新の再検証で OK |
| herdr copy mode（`prefix`、`[`、select、`y`） | herdr の `Ctrl+Shift+v` | herdr の値ではなく外部 application の既存値が paste される。 | 最新の再検証で NG（stale value） |
| herdr copy mode（`prefix`、`[`、select、`y`） | fpasoterm の `Ctrl+Shift+v` / 他 desktop application | 現在の build では未再検証。 | 未確認 |
| 他 desktop application | 他 desktop application | copy/paste 可能。 | 確認済み OK（対照） |
| remote/headless program が出す OSC 52 | local host clipboard | trusted な安全な text で別途検証する。 | local herdr failure の対象外 |

## Clipboard コードを変更する前の手順

1. package 済み artifact ではなく、current source を起動します。

   ```sh
   bin/fpasoterm --close all
   bin/fpasoterm --dev --foreground --console-diagnostics
   ```

2. 上記の表をすべて新しい marker 値で検証します。
3. failing row、fpasoterm version/commit、`DISPLAY`、`WAYLAND_DISPLAY`、`wl-copy`、`wl-paste`、`xclip`、`xsel` のinstall有無を記録します。
4. failing row が使う経路だけを変更します。影響しない row の再検証前に、reader priority を全体的に変更しません。keyboard shortcut と menu 操作は別々に記録します。
5. 次の clipboard 修正を行う前に、必ず結果をこの表へ追記します。

Diagnostics の `terminal paste source=...` は fpasoterm が採用した reader を表します。clipboard の本文は記録しません。

## 調査用であり、回避策ではないもの

`wl-paste --list-types` と X11 の `TARGETS` は提供 format を確認できますが、異なる clipboard owner 間でどちらが新しいかまでは示しません。安全な test marker だけで結果を記録してください。Crostiniでは`xclip`の書込みがexit 0でもChromeOS/Chrome shared clipboardへ反映されないことがあるため、終了statusだけでhost側へのcopy成功とは判定しません。現在、外部 application→herdr の Paste は成功しているため、fpasoterm の Paste とherdr paneへの入力は調査対象ではありません。OSC 52 は local clipboard integration の一律な置換として有効化しません。terminal output は data であり、自動的に trusted clipboard authority にはなりません。

本件から導いた herdr upstream 向け実装提案は、[明示herdr CopyをOSC 52へmirrorする提案](herdr-clipboard-mirroring-proposal.ja.md)を参照してください。
