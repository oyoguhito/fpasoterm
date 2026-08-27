# fpasoterm Specification

## Purpose

fpasoterm is a desktop terminal application focused on Japanese input in ChromeOS Linux while keeping the architecture portable to other operating systems. It is intended to be used alongside terminal multiplexers such as screen / tmux / byobu / herdr rather than implementing split panes. Multiple application windows can be tiled from the titlebar. It deliberately avoids reimplementing features supplied by the shell, multiplexer, or TUI editor, including session/pane management, shell commands, job control, multiplexer configuration, and editor features provided by Vim, Emacs, Fresh, Helix, and similar tools. Compatibility with those tools is a maintenance priority.

## Architecture

- Tauri owns the application window and platform webview input method path.
- xterm.js renders the terminal UI in the renderer process.
- portable-pty creates the shell-backed pseudoterminal in the Rust backend.
- The renderer communicates with the backend through narrow Tauri commands and events.
- Terminal clipboard integration copies selected terminal text, handles OSC 52 copy requests from multiplexers, and sends paste shortcuts through a backend OS clipboard fallback.
- Terminal output logging records the PTY stream that fpasoterm receives after removing common terminal control sequences for readability. Automatic log names include the titlebar title and timestamp. Pane-specific logging is delegated to multiplexers such as tmux, screen, byobu, or herdr because fpasoterm does not implement split-pane awareness.

## ChromeOS Linux Input Policy

fpasoterm does not intercept Japanese keyboard keys such as `かな` or `英数`. Input method switching and composition are delegated to the platform webview and the operating system.

For terminal copy, selecting terminal text and pressing `Ctrl+Shift+C` writes that selection to the OS clipboard through the WebView clipboard event/API and the backend clipboard path. The hamburger window menu contains `Log Start (^S)` / `Log Stop (^S)`, `Log Show (^P)`, `Broadcast (^B)`, `Kill (^K)`, `Copy (^C)`, and `Paste (^V)`. On Unix, `Kill (^K)` or `Ctrl+Shift+K` sends `SIGKILL` to the foreground PTY process group. On Windows, it force-terminates descendants of the terminal shell, from the deepest child upward. Both paths preserve the interactive shell and its window, and report that no command is running at a shell prompt; use the close button to exit the shell. Kill is separate from normal `Ctrl+C` terminal input. `Ctrl+Shift+B` broadcasts normalized text plus Enter only to selected local PTYs and can explicitly include the configured trusted sync channel when all local windows are selected. Kitty APC graphics are experimental and disabled by default. `Ctrl+Shift+L` opens that menu with the log action focused, while `Ctrl+Shift+S` and `Ctrl+Shift+P` invoke logging and log display directly. Right-click copies when a terminal selection exists; otherwise it pastes. Terminal paste first reads the WebView clipboard API during the user gesture, then falls back to the backend clipboard when the WebView result is empty or unavailable, and sends the text to the PTY. Tools such as herdr, tmux, and screen can copy through OSC 52 when configured to emit clipboard sequences; fpasoterm writes those OSC 52 payloads to the OS clipboard. `Ctrl+Shift+M` opens the window menu, and its `Help (^H)` item or `Ctrl+Shift+H` displays the complete application shortcut list.

The terminal log panel keeps keyboard focus inside the panel while it is open. `Tab` and `Shift+Tab` cycle through the log selector, search field, action buttons, close button, and log text area. The focused control is shown with a high-contrast outline. The `Search` button selects and scrolls to the next matching string in the displayed log and shows the current match count. `N` and `j` move to the next match, while `P` and `k` move to the previous match. Arrow keys remain reserved for normal text area scrolling.

The npm binary name is `fpasoterm`. On Linux, `--disable-dmabuf` sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` for WebKitGTK rendering diagnostics.
By default, the launcher detaches from the console. `--foreground` keeps it attached for debugging.
`fpasoterm --list` / `fpasoterm -l` prints one line per running window with its process/session ID, displayed title, and startup time, then exits without opening a window.

`fpasoterm --close <pid|title|all>` / `fpasoterm -q <pid|title|all>` requests a graceful close without opening another window. A numeric value selects a process ID, another value must exactly match the displayed title, and the reserved case-insensitive target `all` closes every running fpasoterm window. No confirmation dialog is shown. If several windows have the same exact title, all matching windows are closed.

Users can install the published npm package directly:

```sh
npm install -g fpasoterm
```

For an unpacked checkout, `npm run install:desktop` installs a local `fpasoterm` command into `XDG_BIN_HOME` or `~/.local/bin`.

`npm run update:desktop` overwrites the same command, launcher entry, and hicolor icon files. `npm run uninstall:desktop` removes those installed files without removing the source checkout or npm dependencies. On Windows, `npm run uninstall:desktop` removes only fpasoterm-specific directories from the current user's `Path`; shared npm directories are not removed.

The project icon is `extra/logo/fpasoterm.png`.

When multiple instances are running, the titlebar window menu exposes
`Tile (^T)`, and `Ctrl+Shift+T` invokes the same grid arrangement. Windows and
X11 support native placement. Wayland compositors may reject application-
controlled positions; the diagnostic log records the requested and actual
positions in that case.

Running instances refresh their cache markers periodically. Tile layout and
title suffix allocation ignore markers that are no longer refreshed. Tile uses
stable grids such as 2x1 for two windows, 2x2 for four, 4x2 for eight, 3x3 for
nine, and 5x2 for ten. Later same-title windows use the next number after the
highest live suffix.

On macOS and Windows, the application executable directory is prepended to the
child shell `PATH`. On macOS, launching `fpasoterm` from inside fpasoterm
detaches the new GUI process so the current shell prompt is released.

The application window uses that PNG as its runtime icon. Linux desktop entries still refer to `Icon=fpasoterm` so installers can place the image in the target icon theme. Size-specific hicolor PNGs are generated under `extra/linux/icons/hicolor/`.

The package license is MIT and the repository must expose `bin.fpasoterm` from `package.json` for global installation.

When the shell-backed PTY exits, fpasoterm closes the owning application window. This makes `exit` behave like closing a normal terminal window.

## Configuration and Plugins

User configuration is read from `~/.config/fpasoterm/User/config.toml`, or from `$XDG_CONFIG_HOME/fpasoterm/User/config.toml` when `XDG_CONFIG_HOME` is set.
`fpasoterm --config <path>` uses another TOML file for one launch. `--width`, `--height`, and `--size` override the configured window size for one launch. `--shell <command>` selects another shell for one launch. `--command <command>` sends a command to the shell after launch. `--reset-window-state` deletes the saved window size. `--reset-config` (`-R`) renames the selected `config.toml` to a timestamped backup, restores all platform defaults, deletes the saved window state so the default 1000x680 size takes effect, and exits.
`--show-config` prints the resolved settings and plugin load status. `--enable-plugin` and `--disable-plugin` select one or more local plugin selectors and edit `plugins.enabled`; selectors may omit the `plugins/` prefix and `.js` or `.ts` suffix when unambiguous.

On launch, fpasoterm writes or refreshes `config.toml.example` with the default settings. fpasoterm does not overwrite an existing user config. When `window.rememberBounds` is enabled, the last window size is saved locally to `~/.config/fpasoterm/User/window-state.json` and restored on the next launch. Saved size overrides explicit `window.width` and `window.height` values in `config.toml`; one-shot CLI overrides are applied last.

Supported config sections:

- `window`: initial window size, minimum window size, background color, theme source, frame/titlebar visibility, and whether to remember the last size locally.
- `terminal`: xterm.js terminal options such as `fontFamily`, `fontSize`, `scrollback`, and `theme`.
- `ime`: duplicate input guard options: `duplicateGuard`, `duplicateWindowMs`, and `repeatedTextWindowMs`.
- `plugins.enabled`: relative plugin paths under the config directory.

Plugins must be placed under `~/.config/fpasoterm/User/plugins/`. `.js` and `.ts` plugins are supported. TypeScript plugins are transpiled to `~/.config/fpasoterm/User/cache/plugins/` at launch and then loaded into the renderer. New convenience behavior should normally be implemented as a plugin rather than added to the core application.

Renderer plugins access `window.fpasotermPluginApi`, which exposes the terminal, fit addon, resolved config, and a diagnostics logger.

The full default configuration is documented in `docs/config.en.md`. See `examples/config/` for sample configs. The runtime plugin API is documented in `docs/plugins.en.md`; reviewed installable plugins and their ports workflow are maintained in [fpasoterm-plugins](https://github.com/oyoguhito/fpasoterm-plugins).

Known platform limitations are tracked in `docs/known-issues.en.md`.

## Diagnostics

Set `FPASOTERM_DEBUG_KEYS=1` to log key and composition events.

Diagnostics are written to:

```text
~/.config/fpasoterm/User/logs/fpasoterm-debug.log
```

The diagnostics and log panel textareas use the same `Ctrl+Shift+C` copy path as the terminal selection.

## Non-goals

- fpasoterm does not manage IBus engines.
- fpasoterm does not implement split panes; use screen, tmux, byobu, or herdr.
- fpasoterm does not emulate OS-level Japanese input switching.
- fpasoterm does not implement terminal shell behavior itself; that is delegated to the user's shell through portable-pty.
- fpasoterm does not reproduce terminal multiplexer features such as pane/session lifecycle, layout management, command orchestration, or multiplexer-specific configuration.
- fpasoterm does not reproduce TUI editor features such as buffers, editing commands, language tooling, or editor-specific configuration; it maintains compatibility with Vim, Emacs, Fresh, Helix, and similar tools.
- fpasoterm does not add general convenience workflows to the core when they can be implemented as a local plugin.
