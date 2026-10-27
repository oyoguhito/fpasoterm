# 画面動画録画

fpasotermはtitlebarの **Log** menuからvideoを録画できます。これは読みやすいterminal output logとは別の機能です。fpasoterm pluginのcanvasが前面で表示されている場合、**Video Start** はそのcanvasを優先して録画します。これにはRDP local bridge pluginが描画するremote desktopが含まれます。plugin canvasが表示されていない場合は、platform WebViewがOS pickerに対応していれば利用者が選択したscreenまたはwindowを録画し、WebKitGTK/ChromeOSのようにpickerがない場合はfpasotermのterminal surfaceを録画します。

## 録画手順

1. titlebarのhamburger menuから **Log** を開きます。
2. **Video Start** を選択します。
3. RDP local bridgeなどreview済みcanvas pluginが前面で開いている場合は、そのremote canvasの録画が直ちに開始し、OS pickerは開きません。そうでない場合、OSのcapture pickerが開いたら録画対象のscreenまたはwindowを選択して共有を承認します。どちらも利用できないplatformではterminal surface recording fallbackが直ちに開始します。
4. titlebarは **Recording** に、menu actionは **Video Stop** に変わります。通常どおりfpasotermを操作できます。
5. **Log → Video Stop** を選択します。最後のchunkを書き込む間は **Saving video** と表示されます。
6. **Log → Video Show** を選択します。**Log Show** と同様に完了済みrecordingの一覧が表示されるため、fileを選択して **Open Selected** を押すとOS既定の関連applicationで開きます。**Delete Selected** を選び確認すると、そのrecordingを完全に削除できます。**Delete All** を選び確認すると、完了済みvideo recordingを全て削除できます。

完了したfileは音声なしのWebM（優先）、MP4、またはanimated GIFで、`logging.directory`、または空の場合は
`~/.config/fpasoterm/User/logs`に
`video-<title>-<pid>-<timestamp>.webm`、`.mp4`、または`.gif`として保存されます。Diagnostics logには最終pathとbyte数を記録します。既存のtext log操作は`terminal-*.log`だけを対象にするため、**Log Show**と**Delete All**はvideo fileを表示・削除しません。GIF/WebM/MP4をtext diagnostics panelへdecodeしないため、**Video Show**は**Log Show**と同じpanelでfileを選択し、OS既定viewerで開きます。**Delete Selected** は確認後に、設定済みlogging directory内の選択済み`video-*.(gif|webm|mp4)` fileだけを削除します。**Delete All** も同じ制限と確認を使い、`terminal-*.log` text logは削除しません。

組込みGIF fallbackは標準の無限repeat extensionを書き込みます。一度だけ再生して止まる場合は、開いているviewerがこのextensionを反映していません。連続再生が必要な場合はGIF対応のimage viewerまたはbrowserを使用してください。

OS pickerが利用できる場合は、それが意図した安全境界です。recordingは明示的な **Video Start** 操作からだけ開始でき、fpasotermはterminal output、plugin code、timerからは開始しません。また利用者に代わってdisplayを選択しません。前面のplugin canvasは例外で、そのpixelは既にfpasoterm WebView内にあるため、他applicationを録画せずにpickerなしで記録できます。RDP経路が記録するのはremote desktop canvasだけであり、fpasoterm titlebar、plugin controls、prompt、iframeは含みません。録画を許可されたscreen/window surfaceだけを選んでください。full screenを選ぶと他applicationや機密情報も含まれることがあります。terminal-surface fallbackは他applicationを録画せず、pickerも必要としません。

## 制限とplatform対応

platform WebViewが`MediaRecorder`を提供する場合、fpasotermはまずWebMを選択し、WebMが利用できない場合だけMP4を選びます。前面のplugin canvasがないscreen/windowの優先経路には`navigator.mediaDevices.getDisplayMedia`も使います。Linux/ChromeOSでは前面のplugin canvasがある場合、native PNG→WebM経路を直ちに使います。plugin canvasがない場合も、このAPIがない、またはportal/deviceがなくpickerが失敗したときには、terminal canvasの同じ経路を使います。fpasotermはpluginまたはterminal canvasのPNG frameを取得し、WebKitGTKが利用しているGStreamer runtime内で`appsrc → VP8 → WebM`として5 fpsでencodeします。WebKitGTKの`CanvasCaptureMediaStream`が、形式上は正常なWebMへ古いcanvas paintだけを記録してしまう問題を回避します。`gst-launch`、ffmpeg、Chromium、外部recorderの導入は不要です。GStreamerのappsrc/VP8/WebM pluginがない最小Linux imageでは、組込みanimated `.gif` writerへfallbackします。macOS arm64では通常のWebView `MediaRecorder`経路で有効なWebMが確認されているため、この経路を維持します。一方Intel macOSのWKWebViewはMP4 MediaRecorderを対応と報告してもCanvasCaptureのmovieが全黒になることがあるため、Intel macOSだけは正常なpluginまたはterminalのPNG snapshotをmacOS標準AVFoundationのH.264 MP4 writerへ直接送ります。AVFoundationを初期化できない場合だけanimated `.gif` writerへfallbackします。この経路ではscreen/window pickerは開かず、前面のplugin canvasがあればそれを、なければfpasoterm terminalを録画します。Windowsはbrowser canvasのMediaRecorder fallbackを維持します。PNGは内部frame形式であり、完成したrecording fileではありません。どの経路でもPNG canvas frameを作れない場合だけ、Video Startはterminalの状態を変えず、titlebarに一時的に **Video unavailable** を表示してdiagnosticを出します。

一部のWebKitGTKはMediaRecorderのtimesliceごとに完結したWebM documentを返します。これらを連結すると、多くのviewerが先頭fragmentだけで再生を止めます。Linux/ChromeOSのcanvas fallbackはこれらを連結せず、PNG snapshotを1本のnative WebM muxerへ直接streamします。WindowsとmacOS arm64のin-WebView canvas MediaRecorder fallbackは、**Video Stop**まで1本のrecordingをbufferし、最終payloadを1回だけ保存します。Intel macOSはpluginまたはterminalのPNG frameをAVFoundation H.264 MP4 encoderへ順次書き込み、AVFoundationの初期化に失敗した場合だけGIF encoderへfallbackします。memoryが少ないsystemでは長時間recordingを避けてください。OS pickerによるscreen/window captureは、対応platformでは引き続きbounded chunkをstreamします。

Intel macOSの現在の組込みrecordingは、前面plugin canvasがあればそれを、なければterminalを対象とし、Screen Recording permissionを必要としません。desktop全体や他application windowを録画する必要がある場合はmacOS標準のscreen recorderを使用してください。macOS arm64は通常のWebView media captureを継続するため、OSに要求された場合はScreen Recording permissionを付与してください。Linux/ChromeOSでは導入済みWebKitGTK/WebViewとportal設定に依存します。Windowsでは導入済みWebView2 runtimeとそのscreen-capture対応に依存します。workflowで使う前に、各target platformでpickerとplugin canvas recordingを確認してください。

audio・microphone capture・automatic capture・編集・streaming・video library UIは初期版の対象外です。GIF fallbackはfull desktop videoではなく、低frame-rateのterminal recordingです。Video Stop前にfpasotermが終了またはWebViewがcrashした場合、記録済みの先頭部分が残ってもvideo fileがfinalizeされないことがあります。可能な限りmenuから停止してください。

## 容量上限

`[logging].videoMaxBytes`は1本のvideo recordingの上限で、既定値は2 GiBです。読みやすいterminal text logだけに適用される`[logging].maxBytes`とは独立しています。保存先に十分な空き容量がある場合だけ増やしてください。

```toml
[logging]
videoMaxBytes = 4294967296 # 4 GiB
```

上限に達するとfpasotermは新しいvideo chunkの受付を止め、それまでに書き込んだ有効なprefixを保存します。**Video Stop**でそのfileをfinalizeしてください。
