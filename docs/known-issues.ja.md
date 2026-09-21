# 現時点の既知課題

## ChromeOS Linux での herdr clipboard の経路差

最新の再検証で fpasoterm↔他 application を含む fpasoterm の clipboard bridge は成功したため、fpasoterm 側の一般的な clipboard 経路は既知課題ではありません。外部 application→herdr も成功しており、これは fpasoterm の Paste が OS clipboard を読み、herdr paneへ正しく入力できることを示します。残る失敗行は herdr copy mode→herdr paste で、herdr の値ではなく外部 application の既存値が貼り付いています。Crostiniではherdrと同じnative X11書込みである`xclip`がexit 0でもChromeOS/Chrome shared clipboardへ反映されないことを確認しており、fpasotermがX11書込みを妨げているのではなく、native clipboardからshared clipboardへの橋渡しが不足しています。herdr copy mode→fpasoterm/他 application は現行 build で未再検証です。確認済みの行と clipboard code を変更する前の必須手順は[Clipboard のフローと検証表](clipboard.ja.md)を参照してください。

## ChromeOS/Baguette のウィンドウ位置

ChromeOS/Baguette では、fpasoterm から desktop runtime window の `x` / `y` 位置を指定しても、実表示には反映されないことを確認しています。調査中、runtime API は `set_position()` で指定位置が適用されたと報告しましたが、実際の画面では compositor/window manager 側で配置されました。

以前の runtime 検証では、遅延して何度も位置を再適用する方法や `moveTop()` を試しましたが、リサイズ時に OS がフリーズする可能性があるため削除しました。Tauri でも 1 回だけの位置復元を試しましたが、対象環境の実表示には反映されませんでした。このため fpasoterm は現時点では window size のみ復元します。window position support は今後の課題として残します。

## ChromeOS/Baguette の透明 terminal 背景

Tauri 移行前にテストした ChromeOS/Baguette 環境では、xterm.js canvas の alpha 背景は透明として合成されませんでした。alpha 付き背景は、デスクトップが透けるのではなく黒または不透明色として表示されました。

Tauri backend は Linux で WebKitGTK を使い、transparent window を有効にし、xterm.js に `allowTransparency = true` と 65% 不透明の terminal 背景を設定します。ChromeOS/Baguette 実機では再検証が必要です。描画がちらつく、黒または白になる場合は `--disable-dmabuf` で起動してください。この引数は `WEBKIT_DISABLE_DMABUF_RENDERER=1` を設定します。

## Kitty/SIXEL graphics

現在のTauri/WebKitGTKでKitty、SIXEL、iTerm inline imageのstreamを描画すると、WebViewが無反応になり`Ctrl+C`も届かなくなることがあります。このため`[terminal.images]`は既定で無効です。

## macOS Gatekeeper

Release build では ad-hoc code signing を使い、CI で生成された `.app` bundle と `.dmg` の構造を検証します。これにより、未署名または構造的に壊れた artifact が upload されることは防ぎますが、Apple Developer ID による署名と notarization とは別物です。

Gatekeeper の警告なしに通常の double-click install を行うには、Release workflow に Developer ID certificate と notarization credentials を設定する必要があります。これらを設定するまでは、CI validation を通過した DMG でも macOS が「壊れている」または「検証できない」と表示する場合があります。
