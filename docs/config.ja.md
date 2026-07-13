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
```

設定済みウィンドウサイズを一時的に上書きする場合:

```sh
fpasoterm --size 1200x760
```

起動後に shell でコマンドを実行する場合:

```sh
fpasoterm --command "tmux attach -t work"
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
width = 1000
height = 680
minWidth = 420
minHeight = 260
backgroundColor = "#101317"
themeSource = "system"
rememberBounds = true
frame = false
[terminal]
cursorBlink = true
cursorStyle = "block"
fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Noto Sans Mono CJK JP\", monospace"
fontSize = 14
scrollback = 1000

[terminal.theme]
background = "#101317"
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

- `window`: 初期ウィンドウサイズ、最小サイズ、背景色、native theme source、frame/titlebar 表示、最後の window bounds を local に記憶するかどうか。`themeSource` は `system`、`light`、`dark` を指定できます。
- `terminal`: terminal 作成時に渡す xterm.js options。
- `ime`: IME composition 向けの二重入力 guard 設定。
- `plugins.enabled`: `~/.config/fpasoterm/User/` からの相対 plugin path。

`window.rememberBounds` が有効な場合、最後の window size は `~/.config/fpasoterm/User/window-state.json` に保存され、次回起動時に復元されます。

window size は、デフォルト設定、`config.toml` に明示した `window.width` / `window.height`、保存済み `window-state.json`、最後に `--size` などの一時 CLI 指定、の順に解決されます。設定変更を保存済み状態より優先したい場合は、`fpasoterm --reset-window-state` を実行してください。

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
