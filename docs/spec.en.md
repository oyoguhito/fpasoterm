# fpasoterm Specification

## Purpose

fpasoterm is a desktop terminal application focused on Japanese input in ChromeOS Linux while keeping the architecture portable to other operating systems. It is intended to be used alongside terminal multiplexers such as screen / tmux / byobu / herdr rather than implementing split panes or multiple-window management itself.

## Architecture

- Tauri owns the application window and platform webview input method path.
- xterm.js renders the terminal UI in the renderer process.
- portable-pty creates the shell-backed pseudoterminal in the Rust backend.
- The renderer communicates with the backend through narrow Tauri commands and events.
- Terminal clipboard integration copies selected terminal text, handles OSC 52 copy requests from multiplexers, and sends paste shortcuts through a backend OS clipboard fallback.
- Terminal output logging records the PTY stream that fpasoterm receives after removing common terminal control sequences for readability. Pane-specific logging is delegated to multiplexers such as tmux, screen, byobu, or herdr because fpasoterm does not implement split-pane awareness.

## ChromeOS Linux Input Policy

fpasoterm does not intercept Japanese keyboard keys such as `かな` or `英数`. Input method switching and composition are delegated to the platform webview and the operating system.

For terminal copy, selecting terminal text and pressing `Ctrl+Shift+C` writes that selection to the OS clipboard through the WebView clipboard event/API and the backend clipboard path. The titlebar `Log (^L)` menu opens with `Ctrl+Shift+L`, toggles logging with `Start (^S)` / `Stop (^S)` or `Ctrl+Shift+S`, and shows captured logs with `Show (^P)` or `Ctrl+Shift+P`. It also exposes `Copy (^C)` and `Paste (^V)` buttons for keyboard-driven operation. Right-click copies when a terminal selection exists; otherwise it pastes. For terminal paste, `Ctrl+Shift+V`, the Log menu `Paste (^V)` button, and right-click paste read the OS clipboard through the backend and send it to the PTY. Tools such as herdr, tmux, and screen can copy through OSC 52 when configured to emit clipboard sequences; fpasoterm writes those OSC 52 payloads to the OS clipboard.

The terminal log panel keeps keyboard focus inside the panel while it is open. `Tab` and `Shift+Tab` cycle through the log selector, search field, action buttons, close button, and log text area. The focused control is shown with a high-contrast outline. The `Search` button selects and scrolls to the next matching string in the displayed log and shows the current match count. `N` and `j` move to the next match, while `P` and `k` move to the previous match. Arrow keys remain reserved for normal text area scrolling.

The npm binary name is `fpasoterm`. On Linux, `--disable-dmabuf` sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` for WebKitGTK rendering diagnostics.
By default, the launcher detaches from the console. `--foreground` keeps it attached for debugging.

Users can install the published npm package directly:

```sh
npm install -g fpasoterm
```

For an unpacked checkout, `npm run install:desktop` installs a local `fpasoterm` command into `XDG_BIN_HOME` or `~/.local/bin`.

`npm run update:desktop` overwrites the same command, launcher entry, and hicolor icon files. `npm run uninstall:desktop` removes those installed files without removing the source checkout or npm dependencies. On Windows, `npm run uninstall:desktop` removes only fpasoterm-specific directories from the current user's `Path`; shared npm directories are not removed.

The project icon is `extra/logo/fpasoterm.png`.

The application window uses that PNG as its runtime icon. Linux desktop entries still refer to `Icon=fpasoterm` so installers can place the image in the target icon theme. Size-specific hicolor PNGs are generated under `extra/linux/icons/hicolor/`.

The package license is MIT and the repository must expose `bin.fpasoterm` from `package.json` for global installation.

When the shell-backed PTY exits, fpasoterm closes the owning application window. This makes `exit` behave like closing a normal terminal window.

## Configuration and Plugins

User configuration is read from `~/.config/fpasoterm/User/config.toml`, or from `$XDG_CONFIG_HOME/fpasoterm/User/config.toml` when `XDG_CONFIG_HOME` is set.
`fpasoterm --config <path>` uses another TOML file for one launch. `--width`, `--height`, and `--size` override the configured window size for one launch. `--shell <command>` selects another shell for one launch. `--command <command>` sends a command to the shell after launch. `--reset-window-state` deletes the saved window size.
`--show-config` prints the resolved settings and plugin load status. `--enable-plugin` and `--disable-plugin` select one or more files below `User/plugins` by file name and edit `plugins.enabled`.

On launch, fpasoterm writes or refreshes `config.toml.example` with the default settings. fpasoterm does not overwrite an existing user config. When `window.rememberBounds` is enabled, the last window size is saved locally to `~/.config/fpasoterm/User/window-state.json` and restored on the next launch. Saved size overrides explicit `window.width` and `window.height` values in `config.toml`; one-shot CLI overrides are applied last.

Supported config sections:

- `window`: initial window size, minimum window size, background color, theme source, frame/titlebar visibility, and whether to remember the last size locally.
- `terminal`: xterm.js terminal options such as `fontFamily`, `fontSize`, `scrollback`, and `theme`.
- `ime`: duplicate input guard options: `duplicateGuard`, `duplicateWindowMs`, and `repeatedTextWindowMs`.
- `plugins.enabled`: relative plugin paths under the config directory.

Plugins must be placed under `~/.config/fpasoterm/User/plugins/`. `.js` and `.ts` plugins are supported. TypeScript plugins are transpiled to `~/.config/fpasoterm/User/cache/plugins/` at launch and then loaded into the renderer.

Renderer plugins access `window.fpasotermPluginApi`, which exposes the terminal, fit addon, resolved config, and a diagnostics logger.

The full default configuration is documented in `docs/config.en.md`. See `examples/config/` for sample configs and `examples/plugins/` for sample plugins.

Known platform limitations are tracked in `docs/known-issues.en.md`.

## Diagnostics

Set `FPASOTERM_DEBUG_KEYS=1` to log key and composition events.

Diagnostics are written to:

```text
diagnostics/fpasoterm-debug.log
```

The diagnostics and log panel textareas use the same `Ctrl+Shift+C` copy path as the terminal selection.

## Non-goals

- fpasoterm does not manage IBus engines.
- fpasoterm does not implement split panes or multiple-window management.
- fpasoterm does not emulate OS-level Japanese input switching.
- fpasoterm does not implement terminal shell behavior itself; that is delegated to the user's shell through portable-pty.
