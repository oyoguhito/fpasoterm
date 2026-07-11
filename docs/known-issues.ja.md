# 現時点の既知課題

## ChromeOS/Baguette のウィンドウ位置

ChromeOS/Baguette では、fpasoterm から desktop runtime window の `x` / `y` 位置を指定しても、実表示には反映されないことを確認しています。調査中、runtime API は `setBounds()` で指定位置が適用されたと報告しましたが、実際の画面では compositor/window manager により中央へ配置されました。

遅延して何度も位置を再適用する方法や `moveTop()` も試しましたが、リサイズ時に OS がフリーズする可能性があるため削除しました。このため fpasoterm は現時点では window size のみ復元します。window position 指定用の CLI 引数は公開しません。

## ChromeOS/Baguette の透明 terminal 背景

テストした ChromeOS/Baguette 環境では、xterm.js canvas の alpha 背景は透明として合成されませんでした。alpha 付き背景は、デスクトップが透けるのではなく黒または不透明色として表示されました。

同じ環境で Terminator では透明 terminal が使えるため、GTK/VTE は xterm.js canvas とは別の compositor 経路で透明化できる可能性があります。将来透明 terminal を再検討する場合は、xterm.js の alpha 調整を続けるより、Linux 専用 GTK/VTE frontend として検討するのが現実的です。
