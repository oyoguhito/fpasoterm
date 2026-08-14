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

Open `Help` from the window menu to see the absolute path of the configuration
file currently used by that window. This also reflects a runtime config file
applied through `OSC 777;config=...`.

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

When `--title` is used, shell-emitted title changes are ignored so the window
label stays stable. Use `OSC 777;title=...` if you intentionally want to rename
the running window from inside the terminal.

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

Restore every setting to its platform default:

```sh
fpasoterm --reset-config
# Short form: fpasoterm -R
```

An existing file is renamed beside it as `config.toml.backup-<timestamp>` before
a complete new `config.toml` is written. The saved `window-state.json` is also
deleted, so the default width of 1000 and height of 680 are used on the next
launch. This command exits without opening a window. With `--config <path>`,
only that selected config file is renamed and reset; the standard local window
state is still cleared.

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
# When omitted, the default is 12 on Intel macOS and 14 on other platforms.
lineHeight = 1.12
minimumContrastRatio = 4.5
rescaleOverlappingGlyphs = true
backgroundOpacity = 0.8
scrollback = 1000
termName = "xterm-256color"
shell = ""

# [terminal.images] is reserved for a future stable renderer.
# Current builds ignore this section. Do not add it to config.toml.

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

[keybindings]
# Mod means Ctrl on Windows/Linux and Cmd on macOS.
prefix = "Mod+Shift"
# A one-letter value inherits prefix. A full value overrides it for one action.
# Physical-key example: newWindow = "Ctrl+Alt+KeyN"
logMenu = "L"
logToggle = "S"
logShow = "P"
copy = "C"
paste = "V"
menu = "M"
help = "H"
newWindow = "N"
broadcast = "B"
kill = "K"
tile = "T"
closeAll = "X"

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
commands = true
commandTtlSeconds = 60

[logging]
enabled = true
directory = ""
autoStart = false
maxBytes = 10485760
```

## Sections

- `window`: titlebar title, initial window size, minimum size, background color, custom titlebar color, native theme source, frame/titlebar visibility, and whether to remember the last bounds locally. `themeSource` can be `system`, `light`, or `dark`. `titleLocked` defaults to `true` so shell-emitted title sequences do not replace the fpasoterm titlebar. `--title` / `-t` and `--titlebar-color` / `-b` override titlebar appearance for one launch.
- `terminal`: xterm.js options passed when the terminal is created. The default `fontFamily` puts Japanese-capable fonts first so half-width kana and CJK characters are preferred during rendering. `minimumContrastRatio` is enabled by default so ANSI foreground colors that are too close to the dark terminal background remain readable. `rescaleOverlappingGlyphs` is enabled by default to reduce CJK glyph clipping and overlap. `terminal.termName` defaults to `xterm-256color`, and the backend PTY exports `TERM=xterm-256color` so terminal multiplexers such as tmux can use terminfo. `terminal.shell` overrides the platform default when non-empty. Windows examples are `powershell.exe`, `pwsh.exe`, and `cmd.exe`. `--shell <command>` / `-s <command>` overrides this for one launch. On Windows, PowerShell 7 (`pwsh.exe`) is the default when it is available. If `pwsh.exe` is not available on `PATH`, fpasoterm checks common PowerShell 7 install paths such as `C:\Program Files\PowerShell\7\pwsh.exe`; a full path can also be used. `[terminal.images]` is reserved and ignored by current builds; do not add or enable it.
- `keybindings`: application shortcut settings. `prefix = "Mod+Shift"` means `Ctrl+Shift` on Windows/Linux and `Cmd+Shift` on macOS. On Windows, set `prefix = "Ctrl+Alt"` when `Ctrl+Shift` is captured by a keyboard layout or another application. This replaces the shared modifier, so the former `Ctrl+Shift` application shortcuts no longer run. Prefix tokens are case-insensitive but may only be `Ctrl`/`Control`, `Alt`/`Option`, `Shift`, `Meta`/`Cmd`/`Command`, or `Mod`; `Ctrl+Esc` is invalid because `Esc` is an action key, not a modifier. An invalid prefix falls back to `Mod+Shift` and the menu provides a tooltip explaining that fallback. A one-letter action value inherits `prefix`; a complete shortcut overrides only that action. Valid action keys include `Escape`, `F1`, `ArrowUp`, and `KeyN`/`Digit1`; for example, use `newWindow = "Ctrl+Alt+KeyN"` or `kill = "Ctrl+Alt+Escape"`. `KeyN`-style values match the physical keyboard key, which avoids keyboard-layout-specific `event.key` differences. The window menu shows the active prefix at its top and each action only shows its key. Restart or apply a runtime config file to refresh the menu labels and bindings.
- `ime`: duplicate input guard settings for IME composition.
- `plugins.enabled`: plugin paths relative to `~/.config/fpasoterm/User/`.
- `sync`: optional sync-folder integration for diagnostics and explicitly requested broadcast commands. `provider = "folder"` uses an already-synced local folder such as Google Drive for desktop. `commands` permits short-lived shared commands and `commandTtlSeconds` limits their lifetime. See [Sync Folder](sync.en.md).
- `logging`: terminal output logging. The hamburger menu contains `Log Start (^S)` / `Log Stop (^S)` and `Log Show (^P)`. `Ctrl+Shift+L` opens that menu at the log actions; `Ctrl+Shift+S` toggles logging directly, and `Ctrl+Shift+P` opens a selector for captured logs. Logging writes readable terminal output with control sequences removed to a local file. Saved automatic log names include the titlebar title and timestamp, for example `terminal-work-<timestamp>.log`. The log panel can delete the selected stopped log, or `Delete All` can empty the active log and delete all stopped `terminal-*.log` files after in-panel confirmation. `directory` defaults to `~/.config/fpasoterm/User/logs` when empty, and can point to a synced folder when needed. Paths can use `~`, `%USERPROFILE%`, `$HOME`, and similar environment variables. `~` is the most portable form when sharing config across operating systems.

When `window.rememberBounds` is enabled, the last window size is saved to `~/.config/fpasoterm/User/window-state.json` and restored on the next launch.

Window appearance and size are resolved in this order: default settings, explicit values in `config.toml`, saved `window-state.json` for size, then one-shot CLI overrides such as `--title`, `--titlebar-color`, and `--size`. If you want config size changes to take effect over the saved state, run `fpasoterm --reset-window-state`.

On Windows, the terminal process receives the fpasoterm executable directory at the front of `Path`. On macOS, fpasoterm regenerates the conventional `~/.local/bin/fpasoterm` command for the currently running app bundle and places `~/.local/bin` first in `PATH`; it forwards every argument unchanged. The previous `~/.config/fpasoterm/bin/fpasoterm` shim is also refreshed for compatibility. This allows `fpasoterm --help`, `--list`, `--close`, and other direct-binary commands to run inside the opened terminal and preserves the command path used by earlier releases. A nested macOS GUI launch detaches by default so the current prompt is released; use `--foreground` when waiting for the new window is intentional. Options documented as Node-launcher-only, unknown options such as `--hoge` or `-?`, and options with missing values are rejected with help by a packaged binary instead of opening an unrelated GUI window. `--version` and the in-app `Help (^H)` panel display the package version plus the build commit, so same-version contributor and PR builds can be distinguished.

macOS normally keeps an application active after its last window is closed. CLI close requests (`--close` / `-q`) and the in-app Close All action explicitly exit each matching fpasoterm process, so `fpasoterm -q all` also removes fpasoterm from the macOS menu bar.

The running titlebar can be updated from inside the terminal. Standard OSC title changes update the window title, and fpasoterm-specific OSC 777 changes update titlebar appearance.

## Terminal Graphics

Kitty Graphics Protocol, SIXEL, and iTerm inline images are not supported by the current build. The xterm.js image addon can make the current Tauri/WebKitGTK WebView unresponsive on ChromeOS, so it is deliberately not loaded even when `[terminal.images]` is present in `config.toml`.

Do not run `kitten icat`, `chafa --format kitty`, or `chafa --format sixels` in fpasoterm for graphics testing. `kitten icat` reports that graphics are unsupported because fpasoterm keeps `TERM=xterm-256color` and does not answer the Kitty graphics capability query. This is expected and avoids the previously reproduced renderer freeze.

## Broadcast Input

Open the hamburger menu and choose `Broadcast (^B)`, or press `Ctrl+Shift+B`. Select one or more local windows by title and PID, enter one or more commands, then choose `Send`. fpasoterm normalizes line endings and appends Enter before delivering the text only to the selected local fpasoterm windows. This is useful for starting the same tmux, herdr, or diagnostic command in several terminals without affecting unrelated windows.

When every local window is selected and sync is enabled, the dialog exposes `Include synced channel`. This publishes the same short-lived command to every already-running fpasoterm instance using the same sync path and channel. Sync delivery is disabled for a local subset because remote window identities are not shared. Command files expire after `sync.commandTtlSeconds` (60 seconds by default) and an instance ignores commands created before it started.

This feature deliberately has no remote server, OAuth token, or automatic command execution for later launches. A shared sync folder becomes a command channel when this option is used. Use it only with a folder and channel trusted by every participating machine.

The following `printf` examples are for POSIX shells such as `bash`, `dash`, and `fish`. They do not run as-is in Windows PowerShell or cmd.exe.

```sh
printf '\033]0;work\a\r\n'
printf '\033]777;titlebarColor=#2e7d32\a\r\n'
printf '\033]777;opacity=0.65\a\r\n'
printf '\033]777;title=work;titlebarColor=#2e7d32\a\r\n'
printf '\033]777;log=start\a\r\n'
printf '\033]777;log=stop\a\r\n'
```

In PowerShell, emit the same fpasoterm OSC 777 sequence with:

```powershell
[Console]::Write("$([char]27)]777;title=work;titlebarColor=#2e7d32$([char]7)`r`n")
```

The runtime config sample can be applied with:

```sh
./examples/apply-runtime-appearance.sh
```

On Windows PowerShell or cmd.exe:

```powershell
.\examples\apply-runtime-appearance.ps1
.\examples\apply-runtime-appearance.bat
```

This sample changes the title to `RUNTIME SAMPLE ACTIVE`, switches the titlebar to pink, and changes the terminal background and text colors.

To return the running window to the default appearance:

```sh
./examples/apply-default-appearance.sh
```

On Windows PowerShell or cmd.exe:

```powershell
.\examples\apply-default-appearance.ps1
.\examples\apply-default-appearance.bat
```

Or, if you need to specify the path manually:

```sh
config_path="$(pwd)/examples/config/runtime-appearance.toml"
printf '\033]777;config=%s\a\r\n' "$config_path"
```

In Windows PowerShell, specify the path manually with:

```powershell
$configPath = Resolve-Path .\examples\config\runtime-appearance.toml
[Console]::Write("$([char]27)]777;config=$configPath$([char]7)`r`n")
```

Runtime config application keeps the current shell session running. It applies live window and terminal appearance settings such as `window.title`, `window.titlebarColor`, `window.width`, `window.height`, `terminal.fontSize`, `terminal.lineHeight`, `terminal.minimumContrastRatio`, `terminal.fontFamily`, `terminal.backgroundOpacity`, and `terminal.theme`. Settings that require a new PTY, such as `terminal.shell`, take effect on the next launch.

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
