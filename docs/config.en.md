# fpasoterm Configuration

fpasoterm reads user-editable settings from:

```text
~/.config/fpasoterm/User/config.toml
```

On launch, fpasoterm writes or refreshes the full default example at:

```text
~/.config/fpasoterm/User/config.toml.example
```

Copy the example to `config.toml` and edit only the values you want to change. Existing `config.toml` files are not overwritten. If `config.toml.example` is missing or outdated, fpasoterm regenerates it on the next launch.

Use another config file for one launch:

```sh
fpasoterm --config ~/.config/fpasoterm/User/work.toml
fpasoterm -c ~/.config/fpasoterm/User/work.toml
```

Temporarily override the configured window size:

```sh
fpasoterm --size 1200x760
fpasoterm -z 1200x760
```

Temporarily override the titlebar title or color. This is useful when multiple fpasoterm windows are open:

```sh
fpasoterm --title work --titlebar-color '#2e7d32'
fpasoterm -t logs -b '#6a1b9a'
```

Run a command in the shell after launch:

```sh
fpasoterm --command "tmux attach -t work"
fpasoterm -e "tmux attach -t work"
```

Use another shell for one launch:

```sh
fpasoterm --shell pwsh.exe
fpasoterm --shell cmd.exe
fpasoterm -s /usr/bin/fish
```

Delete the saved window size:

```sh
fpasoterm --reset-window-state
```

Print the resolved configuration and plugin status:

```sh
fpasoterm --show-config
```

Enable or disable plugins from the command line:

```sh
fpasoterm --enable-plugin hello.ts,theme.ts
fpasoterm --disable-plugin hello.ts,theme.ts
```

Plugin commands select files below `User/plugins` by file name. Separate multiple
names with commas or repeat the option. If the same file name exists in more than
one subdirectory, specify its plugins-relative path, such as `group/hello.ts`.

## Full Default

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

## Sections

- `window`: titlebar title, initial window size, minimum size, background color, custom titlebar color, native theme source, frame/titlebar visibility, and whether to remember the last bounds locally. `themeSource` can be `system`, `light`, or `dark`. `--title` / `-t` and `--titlebar-color` / `-b` override titlebar appearance for one launch.
- `terminal`: xterm.js options passed when the terminal is created. `terminal.termName` defaults to `xterm-256color`, and the backend PTY exports `TERM=xterm-256color` so terminal multiplexers such as tmux can use terminfo. `terminal.shell` overrides the platform default when non-empty. Windows examples are `powershell.exe`, `pwsh.exe`, and `cmd.exe`. `--shell <command>` / `-s <command>` overrides this for one launch. If `pwsh.exe` is not available on `PATH`, fpasoterm checks common PowerShell 7 install paths such as `C:\Program Files\PowerShell\7\pwsh.exe`; a full path can also be used.
- `ime`: duplicate input guard settings for IME composition.
- `plugins.enabled`: plugin paths relative to `~/.config/fpasoterm/User/`.

When `window.rememberBounds` is enabled, the last window size is saved to `~/.config/fpasoterm/User/window-state.json` and restored on the next launch.

Window appearance and size are resolved in this order: default settings, explicit values in `config.toml`, saved `window-state.json` for size, then one-shot CLI overrides such as `--title`, `--titlebar-color`, and `--size`. If you want config size changes to take effect over the saved state, run `fpasoterm --reset-window-state`.

The running titlebar can be updated from inside the terminal. Standard OSC title changes update the window title, and fpasoterm-specific OSC 777 changes update titlebar appearance:

```sh
printf '\033]0;work\a\r\n'
printf '\033]777;titlebarColor=#2e7d32\a\r\n'
printf '\033]777;opacity=0.65\a\r\n'
printf '\033]777;title=work;titlebarColor=#2e7d32\a\r\n'
```

The runtime config sample can be applied with:

```sh
./examples/apply-runtime-appearance.sh
```

This sample changes the title to `RUNTIME SAMPLE ACTIVE`, switches the titlebar to pink, and changes the terminal background and text colors.

To return the running window to the default appearance:

```sh
./examples/apply-default-appearance.sh
```

Or, if you need to specify the path manually:

```sh
config_path="$(pwd)/examples/config/runtime-appearance.toml"
printf '\033]777;config=%s\a\r\n' "$config_path"
```

Runtime config application keeps the current shell session running. It applies live window and terminal appearance settings such as `window.title`, `window.titlebarColor`, `window.width`, `window.height`, `terminal.fontSize`, `terminal.fontFamily`, `terminal.backgroundOpacity`, and `terminal.theme`. Settings that require a new PTY, such as `terminal.shell`, take effect on the next launch.

TOML does not allow the same table to be defined more than once. To test values such as `frame = true`, edit the existing `[window]` section. Adding another `[window]` section at the end of the file causes a config parse error.

## Plugins

Plugins live under:

```text
~/.config/fpasoterm/User/plugins/
```

Enable them in `config.toml`:

```toml
[plugins]
enabled = ["plugins/example.ts"]
```

TypeScript plugins are transpiled to:

```text
~/.config/fpasoterm/User/cache/plugins/
```

See `examples/config/` for sample configs and `examples/plugins/` for sample plugins.
