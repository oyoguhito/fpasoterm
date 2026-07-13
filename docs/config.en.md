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
```

Temporarily override the configured window size:

```sh
fpasoterm --size 1200x760
```

Run a command in the shell after launch:

```sh
fpasoterm --command "tmux attach -t work"
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
width = 1000
height = 680
minWidth = 420
minHeight = 260
backgroundColor = "rgba(0, 0, 0, 0)"
themeSource = "system"
rememberBounds = true
frame = false
[terminal]
allowTransparency = true
cursorBlink = true
cursorStyle = "block"
fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Noto Sans Mono CJK JP\", monospace"
fontSize = 14
scrollback = 1000

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

- `window`: initial window size, minimum size, background color, native theme source, frame/titlebar visibility, and whether to remember the last bounds locally. `themeSource` can be `system`, `light`, or `dark`.
- `terminal`: xterm.js options passed when the terminal is created.
- `ime`: duplicate input guard settings for IME composition.
- `plugins.enabled`: plugin paths relative to `~/.config/fpasoterm/User/`.

When `window.rememberBounds` is enabled, the last window size is saved to `~/.config/fpasoterm/User/window-state.json` and restored on the next launch.

Window size is resolved in this order: default settings, explicit `window.width` / `window.height` values in `config.toml`, saved `window-state.json`, then one-shot CLI overrides such as `--size`. If you want config changes to take effect over the saved state, run `fpasoterm --reset-window-state`.

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
