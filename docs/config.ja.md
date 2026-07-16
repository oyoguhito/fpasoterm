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
themeSource = "system"
rememberBounds = true
frame = false
[terminal]
allowTransparency = true
cursorBlink = true
cursorStyle = "block"
fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Noto Sans Mono CJK JP\", monospace"
fontSize = 14
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
```

## セクション

- `window`: titlebar の表示名、初期ウィンドウサイズ、最小サイズ、背景色、custom titlebar 色、native theme source、frame/titlebar 表示、最後の window bounds を local に記憶するかどうか。`themeSource` は `system`、`light`、`dark` を指定できます。`--title` / `-t` と `--titlebar-color` / `-b` は一度だけ titlebar 表示を上書きします。
- `terminal`: terminal 作成時に渡す xterm.js options。`terminal.termName` は既定で `xterm-256color` です。backend PTY も `TERM=xterm-256color` を設定するため、tmux などの terminal multiplexer が terminfo を利用できます。`terminal.shell` は空でなければ platform default shell を上書きします。Windows では `powershell.exe`、`pwsh.exe`、`cmd.exe` などを指定できます。`--shell <command>` / `-s <command>` は一度だけこの設定を上書きします。
- `ime`: IME composition 向けの二重入力 guard 設定。
- `plugins.enabled`: `~/.config/fpasoterm/User/` からの相対 plugin path。

`window.rememberBounds` が有効な場合、最後の window size は `~/.config/fpasoterm/User/window-state.json` に保存され、次回起動時に復元されます。

window 表示と size は、デフォルト設定、`config.toml` に明示した値、size については保存済み `window-state.json`、最後に `--title`、`--titlebar-color`、`--size` などの一時 CLI 指定、の順に解決されます。size 設定変更を保存済み状態より優先したい場合は、`fpasoterm --reset-window-state` を実行してください。

起動中の titlebar は terminal 内の command からも変更できます。標準の OSC title sequence は window title を変更し、fpasoterm 独自の OSC 777 は titlebar 表示を変更します。

```sh
printf '\033]0;work\a\r\n'
printf '\033]777;titlebarColor=#2e7d32\a\r\n'
printf '\033]777;opacity=0.65\a\r\n'
printf '\033]777;title=work;titlebarColor=#2e7d32\a\r\n'
```

runtime config sample は次で適用できます。

```sh
./examples/apply-runtime-appearance.sh
```

この sample は title を `RUNTIME SAMPLE ACTIVE` にし、titlebar をピンク、terminal 背景と文字色を分かりやすく変更します。

起動中の window を標準の見た目へ戻す場合:

```sh
./examples/apply-default-appearance.sh
```

path を手動指定する場合:

```sh
config_path="$(pwd)/examples/config/runtime-appearance.toml"
printf '\033]777;config=%s\a\r\n' "$config_path"
```

runtime config 適用では、現在の shell session は維持されます。`window.title`、`window.titlebarColor`、`window.width`、`window.height`、`terminal.fontSize`、`terminal.fontFamily`、`terminal.backgroundOpacity`、`terminal.theme` など、起動中に反映可能な表示設定を適用します。`terminal.shell` のように新しい PTY が必要な設定は次回起動時に反映されます。

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
