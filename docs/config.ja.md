# fpasoterm 設定

fpasoterm はユーザー編集用の設定を以下から読み込みます。

```text
~/.config/fpasoterm/User/config.toml
```

起動時に、全デフォルト項目を含む example を以下へ書き出し、古い場合は更新します。

```text
~/.config/fpasoterm/User/config.toml.example
```

`config.toml.example` を `config.toml` にコピーし、変更したい値だけ編集してください。既存の `config.toml` は上書きしません。`config.toml.example` が無い場合や古い場合は、次回起動時に再生成されます。

別の設定ファイルを一度だけ使う場合:

```sh
fpasoterm --config ~/.config/fpasoterm/User/work.toml
fpasoterm -c ~/.config/fpasoterm/User/work.toml
```

設定済みウィンドウサイズを一時的に上書きする場合:

```sh
fpasoterm --size 1200x760
fpasoterm -z 1200x760
```

titlebar の表示名や色を一時的に上書きする場合。複数ウィンドウを開いた時の識別に使えます。

```sh
fpasoterm --title work --titlebar-color '#2e7d32'
fpasoterm -t logs -b '#6a1b9a'
```

`--title` を使った場合、shell が送る title change は無視されるため、
ウィンドウ識別用の表示名が維持されます。起動中 terminal から意図して
変更したい場合は `OSC 777;title=...` を使ってください。

起動後に shell でコマンドを実行する場合:

```sh
fpasoterm --command "tmux attach -t work"
fpasoterm -e "tmux attach -t work"
```

一度だけ別の shell を使う場合:

```sh
fpasoterm --shell pwsh.exe
fpasoterm --shell cmd.exe
fpasoterm -s /usr/bin/fish
```

保存済みウィンドウサイズを削除する場合:

```sh
fpasoterm --reset-window-state
```

全設定をOSごとのデフォルトへ戻す場合:

```sh
fpasoterm --reset-config
# 短縮形: fpasoterm -R
```

既存ファイルは同じ場所の `config.toml.backup-<timestamp>` へrenameして残し、
完全な新しい`config.toml`を生成します。保存済み`window-state.json`も削除するため、
次回起動時はデフォルトの幅1000、高さ680が使われます。このコマンドはwindowを
開かず終了します。`--config <path>`と併用した場合は選択したconfigだけをrenameして
resetし、標準のローカルwindow stateも削除します。

解決済み設定と plugin 状態を表示する場合:

```sh
fpasoterm --show-config
```

コマンドラインから plugin を有効化・無効化する場合:

```sh
fpasoterm --enable-plugin hello.ts,theme.ts
fpasoterm --disable-plugin hello.ts,theme.ts
```

plugin 操作は `User/plugins` 配下のファイル名で選択します。複数指定はカンマ区切り、
または同じオプションの繰り返しが使用できます。同名ファイルが複数のサブディレクトリに
ある場合は `group/hello.ts` のように plugins directory からの相対 path を指定します。

## 全デフォルト

```toml
[window]
title = "fpasoterm"
width = 1000
height = 680
minWidth = 420
minHeight = 260
backgroundColor = "rgba(0, 0, 0, 0)"
titlebarColor = "#1565c0"
titleLocked = true
themeSource = "system"
rememberBounds = true
frame = false
[terminal]
allowTransparency = true
cursorBlink = true
cursorStyle = "block"
fontFamily = "\"Noto Sans Mono CJK JP\", \"Noto Sans CJK JP\", \"BIZ UDGothic\", \"Hiragino Sans\", Meiryo, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
fontSize = 14
# 省略時の既定値はmacOS Intelで12、その他のOSで14です。
lineHeight = 1.12
minimumContrastRatio = 4.5
rescaleOverlappingGlyphs = true
backgroundOpacity = 0.8
scrollback = 1000
termName = "xterm-256color"
shell = ""

[terminal.theme]
background = "rgba(16, 19, 23, 0.80)"
foreground = "#e8edf2"
cursor = "#f5d76e"
selectionBackground = "#35506b"
black = "#11151a"
red = "#ff6b6b"
green = "#8bd17c"
yellow = "#f5d76e"
blue = "#7bb7ff"
magenta = "#d7a8ff"
cyan = "#63d4d5"
white = "#e8edf2"
brightBlack = "#5d6978"
brightRed = "#ff8f8f"
brightGreen = "#ade89f"
brightYellow = "#ffe08a"
brightBlue = "#a4ceff"
brightMagenta = "#e3c3ff"
brightCyan = "#9de9ea"
brightWhite = "#ffffff"

[ime]
duplicateGuard = true
duplicateWindowMs = 800
repeatedTextWindowMs = 140

[plugins]
enabled = []

[sync]
enabled = false
provider = "folder"
path = ""
channel = "default"
diagnostics = true
maxBytes = 1048576

[logging]
enabled = true
directory = ""
autoStart = false
maxBytes = 10485760
```

## セクション

- `window`: titlebar の表示名、初期ウィンドウサイズ、最小サイズ、背景色、custom titlebar 色、native theme source、frame/titlebar 表示、最後の window bounds を local に記憶するかどうか。`themeSource` は `system`、`light`、`dark` を指定できます。`titleLocked` は既定で `true` で、shell が送る title sequence で fpasoterm の titlebar が上書きされないようにします。`--title` / `-t` と `--titlebar-color` / `-b` は一度だけ titlebar 表示を上書きします。
- `terminal`: terminal 作成時に渡す xterm.js options。既定の `fontFamily` は半角カタカナや CJK 文字を優先して描画するため、日本語対応フォントを先頭にしています。`minimumContrastRatio` は既定で有効で、暗い terminal background と近すぎる ANSI foreground 色も読めるように補正します。`rescaleOverlappingGlyphs` は CJK glyph の欠けや重なりを抑えるため既定で有効です。`terminal.termName` は既定で `xterm-256color` です。backend PTY も `TERM=xterm-256color` を設定するため、tmux などの terminal multiplexer が terminfo を利用できます。`terminal.shell` は空でなければ platform default shell を上書きします。Windows では `powershell.exe`、`pwsh.exe`、`cmd.exe` などを指定できます。`--shell <command>` / `-s <command>` は一度だけこの設定を上書きします。Windows では PowerShell 7 (`pwsh.exe`) が利用可能な場合に既定 shell として使われます。`pwsh.exe` が `PATH` に無い場合、fpasoterm は `C:\Program Files\PowerShell\7\pwsh.exe` などの一般的な PowerShell 7 install path も確認します。full path も指定できます。
- `ime`: IME composition 向けの二重入力 guard 設定。
- `plugins.enabled`: `~/.config/fpasoterm/User/` からの相対 plugin path。
- `sync`: diagnostics を同期フォルダで共有する設定。`provider = "folder"` は Google Drive for desktop などで同期済みのローカルフォルダを使います。詳細は [Sync Folder](sync.ja.md) を参照してください。
- `logging`: terminal output logging 設定。hamburger menu に `Log Start (^S)` / `Log Stop (^S)` と `Log Show (^P)` を表示します。`Ctrl+Shift+L` はlog操作にfocusした状態でmenuを開き、`Ctrl+Shift+S` は記録を直接切り替え、`Ctrl+Shift+P` はcaptured `terminal-*.log` の一覧から表示対象を選択する画面を開きます。制御シーケンスを除去した readable terminal output を local file に記録します。log panel では選択した停止済み log の削除ができ、`Delete All` は log panel 内の確認で承認された場合だけ active log を空にして、設定済み log directory の停止済み `terminal-*.log` を全て削除します。`directory` が空の場合は `~/.config/fpasoterm/User/logs` が使われ、必要に応じて同期フォルダを指定できます。path には `~`、`%USERPROFILE%`、`$HOME` などを使えます。OS 間で共有する設定では `~` が最も扱いやすい指定です。

`window.rememberBounds` が有効な場合、最後の window size は `~/.config/fpasoterm/User/window-state.json` に保存され、次回起動時に復元されます。

window 表示と size は、デフォルト設定、`config.toml` に明示した値、size については保存済み `window-state.json`、最後に `--title`、`--titlebar-color`、`--size` などの一時 CLI 指定、の順に解決されます。size 設定変更を保存済み状態より優先したい場合は、`fpasoterm --reset-window-state` を実行してください。

Windowsでは、起動したterminal processの`Path`先頭にfpasoterm executable directoryを追加します。macOSでは、現在起動中のapp bundleを参照する`~/.config/fpasoterm/bin/fpasoterm` shimを毎回生成して`PATH`先頭に置き、全引数を変更せず転送します。これによりglobal user/system PATHを変更せず、fpasoterm内で`fpasoterm --help`、`--list`、`--close`など直接binaryのcommandを実行できます。macOSで新しいGUIを起動する場合は既定でprocessを切り離して現在のpromptを解放します。終了まで待つ場合は`--foreground`を使います。Node launcher専用option、`--hoge`や`-?`などの未知option、値不足のoptionを配布binaryへ指定した場合は、無関係なGUIを開かずhelp付きerrorにします。terminalで`--version`出力を確認できない場合でも、app内の`Help (^H)` panelには現在実行中binaryへcompileされたversionを表示します。

macOSは最後のwindowを閉じてもapplicationをactiveのまま維持するのが通常動作です。CLIの`--close` / `-q`とapp内のClose Allでは一致する各fpasoterm processを明示終了するため、`fpasoterm -q all`後はmacOSのメニューバーにもfpasotermを残しません。

起動中の titlebar は terminal 内の command からも変更できます。標準の OSC title sequence は window title を変更し、fpasoterm 独自の OSC 777 は titlebar 表示を変更します。

次の `printf` 例は POSIX shell (`bash`、`dash`、`fish` など) 向けです。Windows の PowerShell や cmd.exe ではそのまま使えません。

```sh
printf '\033]0;work\a\r\n'
printf '\033]777;titlebarColor=#2e7d32\a\r\n'
printf '\033]777;opacity=0.65\a\r\n'
printf '\033]777;title=work;titlebarColor=#2e7d32\a\r\n'
printf '\033]777;log=start\a\r\n'
printf '\033]777;log=stop\a\r\n'
```

PowerShell で直接送る場合:

```powershell
[Console]::Write("$([char]27)]777;title=work;titlebarColor=#2e7d32$([char]7)`r`n")
```

runtime config sample は次で適用できます。

```sh
./examples/apply-runtime-appearance.sh
```

Windows PowerShell または cmd.exe では次を使えます。

```powershell
.\examples\apply-runtime-appearance.ps1
.\examples\apply-runtime-appearance.bat
```

この sample は title を `RUNTIME SAMPLE ACTIVE` にし、titlebar をピンク、terminal 背景と文字色を分かりやすく変更します。

起動中の window を標準の見た目へ戻す場合:

```sh
./examples/apply-default-appearance.sh
```

Windows PowerShell または cmd.exe では次を使えます。

```powershell
.\examples\apply-default-appearance.ps1
.\examples\apply-default-appearance.bat
```

path を手動指定する場合:

```sh
config_path="$(pwd)/examples/config/runtime-appearance.toml"
printf '\033]777;config=%s\a\r\n' "$config_path"
```

Windows PowerShell で path を手動指定する場合:

```powershell
$configPath = Resolve-Path .\examples\config\runtime-appearance.toml
[Console]::Write("$([char]27)]777;config=$configPath$([char]7)`r`n")
```

runtime config 適用では、現在の shell session は維持されます。`window.title`、`window.titlebarColor`、`window.width`、`window.height`、`terminal.fontSize`、`terminal.lineHeight`、`terminal.minimumContrastRatio`、`terminal.fontFamily`、`terminal.backgroundOpacity`、`terminal.theme` など、起動中に反映可能な表示設定を適用します。`terminal.shell` のように新しい PTY が必要な設定は次回起動時に反映されます。

TOML では同じ table を複数回定義できません。`frame = true` などを試す場合は、既存の `[window]` section 内の値を編集してください。ファイル末尾へ新しく `[window]` を追加すると config parse error になります。

## Plugins

Plugin は以下に配置します。

```text
~/.config/fpasoterm/User/plugins/
```

`config.toml` で有効化します。

```toml
[plugins]
enabled = ["plugins/example.ts"]
```

TypeScript plugin は以下へ変換されます。

```text
~/.config/fpasoterm/User/cache/plugins/
```

設定サンプルは `examples/config/`、plugin sample は `examples/plugins/` を参照してください。
