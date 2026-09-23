# herdr の明示 Copy を OSC 52 へ mirror する提案

これは herdr upstream 向けの実装・検証メモです。この repository から herdr の
コードを変更するものではありません。調査した herdr revision は
[`100cda3c`](https://github.com/herdrdev/herdr/tree/100cda3c)です。

## 問題

ChromeOS Linux/Crostini では、local herdr の Copy が container 内の Wayland または
X11 clipboard へ到達しても、ChromeOS/Chrome の shared clipboard へ届かない場合が
あります。その結果、次の Paste は外部 application 由来の古い値になります。

| 経路 | 確認結果 |
| --- | --- |
| fpasoterm → 外部 application | 成功 |
| 外部 application → fpasoterm | 成功 |
| 外部 application → fpasoterm Paste → herdr pane | 成功 |
| herdr copy mode → fpasoterm Paste → herdr pane | 失敗。以前の外部値が貼り付く |

検証環境は `DISPLAY=:0`、`WAYLAND_DISPLAY=wayland-0` で、
`SSH_CONNECTION`、`SSH_TTY`、`VSCODE_IPC_HOOK_CLI` は空、WSL marker もありません。
従って、既存の SSH/VS Code Remote/WSL 用 OSC 52 優先条件は発動していません。

herdr Copy 後、`wl-paste` は3秒以内に応答せず、X11 inspection は以前の外部値を
返しました。また、この環境では `xclip` が成功終了しても ChromeOS/Chrome shared
clipboard が更新されたとは限りません。native command のexit statusだけでは
host clipboard へのdeliveryを判断できません。

## 現行実装

[`src/selection.rs`](https://github.com/herdrdev/herdr/blob/100cda3c/src/selection.rs#L337-L368)
の`write_osc52_bytes()`は次の動作です。

1. SSH/WSL/VS Code Remote ではない場合、`platform::write_clipboard(bytes)`を呼びます。
2. native write がsuccessなら、OSC 52を出さずreturnします。
3. native write失敗時だけ、BEL終端のOSC 52をstdoutへ出します。

Linux の[`src/platform/linux.rs`](https://github.com/herdrdev/herdr/blob/100cda3c/src/platform/linux.rs#L978-L1000)
は、`WAYLAND_DISPLAY`があれば`wl-copy`、`DISPLAY`があれば`xclip`、`xsel`を順に
試します。通常のLinuxでは適切なnative-first policyですが、Crostiniではnative
providerがhost shared clipboardから分離されることがあります。

fpasoterm は trusted OSC 52を既に受信でき、GTK clipboard経路でhost shared
clipboardへ書き込めます。通常のfpasoterm Copy/Pasteがこの環境で成功するのは
この経路です。

## 提案する修正

herdrが受理したclipboard writeでは、既存のnative writeを維持したまま、同じbytesを
OSC 52としてもmirrorします。

```text
明示的な herdr Copy
        ├─ native provider: wl-copy / xclip / xsel
        └─ OSC 52 stdout mirror
                 └─ 対応terminal（例: fpasoterm）がhost clipboardへ同期
```

OSC 52 mirrorはnative writeが失敗した場合だけのfallbackにしません。2本目の
delivery routeです。OSC 52を扱わないterminalでは既存native挙動が残り、両方を扱う
terminalでは同じ明示Copy値を2回受けますが、clipboard writeは冪等です。

概念的には、現在のearly returnを次へ置き換えます。

```rust
if !should_prefer_osc52() {
    let _ = crate::platform::write_clipboard(bytes);
}
emit_osc52_to_stdout(bytes);
```

実装では既存の`osc52_sequence()`、BEL terminator、stdout flushをそのまま使います。
SSH環境変数を偽装したりterminal名でproviderを切り替えたりしません。

## 範囲と安全性

- herdrが既に受理しているclipboard writeだけに適用します。これは明示的な
  user selection/copy、または既存trusted clipboard-forwarding経路です。
- fpasotermで、任意terminal outputを無条件にbrowser clipboard authorityとして
  扱う変更は行いません。WebView clipboard writeにはuser gestureと`security.osc52`
  policyを維持します。
- native clipboard supportは削除しません。通常のlocal Linux terminalやOSC 52を
  扱わないterminalでは引き続き最適な経路です。
- size limitを新設するなら、既存OSC 52 fallbackにも同じ制約を適用して明記します。

## upstream で追加するtest

実desktop clipboardに依存しないよう、delivery decisionを小さくrefactorして次を
testできるようにします。

1. local environmentかつnative write成功: native writerが1回呼ばれ、期待する
   BEL終端OSC 52が出力される。
2. local environmentかつnative write失敗: native writerが1回試行され、同じOSC 52が
   出力される。
3. SSH、VS Code Remote、WSL優先環境: 現行どおりnative writerをskipし、OSC 52を出力する。
4. empty / Unicode selectionで既存のbytesとbase64 encodingが維持される。

process stdoutをglobal captureするより、native-write closureとoutput writerを渡せる
小さなhelperを作る方がtestを安定させられます。

## 手動受入検証

他と重複しない安全なmarkerを使用します。結果を報告するためにterminal outputを
copyするとclipboardが上書きされるため、destinationの検証前には選択/Copyをしません。

1. fpasoterm source buildをconsole diagnostics付きで起動します。

   ```sh
   bin/fpasoterm --close all
   bin/fpasoterm --dev --foreground --console-diagnostics
   ```

2. fpasoterm terminalでherdrを起動し、通常copy modeで
   `HERDR-OSC52-CHECK-001`をCopyします。
3. fpasotermが本文を出さず、次の2行を記録することを確認します。

   ```text
   OSC 52 clipboard received bytes=...
   OSC 52 clipboard wrote bytes=...
   ```

4. ほかの文字列を選択/Copyする前に、fpasoterm Paste経由の別herdr paneと外部desktop
   applicationへPasteします。両方で`HERDR-OSC52-CHECK-001`が貼り付くことを確認します。
5. Crostini以外のLinux desktopでも再確認し、native clipboard挙動が残り、OSC 52を
   未対応のterminalでerrorにならないことを確認します。

## PR説明文のたたき台

> Mirror accepted herdr clipboard writes through OSC 52 even when a local
> native clipboard provider succeeds. On Crostini, `wl-copy`/`xclip` can update
> a container-local selection without updating the ChromeOS shared clipboard.
> The OSC 52 mirror lets supporting terminals bridge the same explicit user
> copy to their host clipboard while preserving the native path for all other
> terminals.
