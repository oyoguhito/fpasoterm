# Changelog

## 1.4.1

- Added a Window menu `New (^N)` action and `Ctrl+Shift+N` / `Cmd+Shift+N` shortcut for opening another fpasoterm window.
- Fixed Windows Tile target detection by checking live instance PIDs with the Windows process API instead of treating stale markers as active.
- Made the Close All confirmation window explicit, decorated, non-transparent, visible, resizable, and larger so Windows users can cancel, confirm, or close it normally.

## 1.4.0

- Improved Tile sizing by converting renderer logical screen dimensions to native physical pixels with the display device pixel ratio.
- Added an independent confirmation window for Close All, with keyboard focus, Tab navigation, Cancel, OK, and Escape handling.
- Prevented stale Close All requests from affecting newly started windows and restored terminal focus after cancellation.
- Added optional `--x11` support for Linux window placement diagnostics.

## 1.3.6

- Improved Log menu keyboard labels and shortcuts for logging, copy, and paste operations.
- Added keyboard-accessible Log Show search with match counts, next/previous navigation, visible focus states, and panel-contained focus cycling.
- Replaced native delete confirmations with an in-panel confirmation dialog so Delete Selected and Delete All keep focus inside the log panel.

## 1.3.5

- Preserved half-width katakana in terminal display and readable terminal logs instead of normalizing it to full-width katakana.
- Added terminal selection copy support for `Ctrl+Shift+C`, right-click copy when text is selected, and host WebView clipboard integration for paste into other applications.
- Removed the Log Show copy button and made Log Show textarea selections copy with `Ctrl+Shift+C`.
- Added keyboard-accessible Log menu Copy/Paste buttons and arrow-key menu navigation.

## 1.3.4

- Fixed Windows clipboard handling for Japanese paths copied from `Log Show` by writing native UTF-16 `CF_UNICODETEXT` clipboard data directly.

## 1.3.3

- Removed the retired `Sync:` titlebar status UI entirely while keeping silent sync diagnostics snapshots.
- Fixed Windows clipboard copy/paste of Japanese paths from `Log Show` by routing PowerShell clipboard fallback through UTF-8 temporary files.

## 1.3.2

- Removed the retired `Synced` titlebar/status wording from sync diagnostics and setup prompts.
- Added `--version` and `-v` to both the Node launcher and packaged app binary.
- Documented Windows overwrite-update checks for verifying the installed executable version.

## 1.3.0

- Added folder-based sync for explicit clipboard text and diagnostics using local sync folders such as Google Drive for desktop.
- Added terminal output logging with `Log Start` / `Log Stop` and OSC 777 controls.
- Added interactive `--setup-sync` configuration for first-time sync folder setup.
- Removed the temporary web console feature and related `--web-console` options.

## 1.2.2

- Allowed multiple fpasoterm windows on ChromeOS/Linux by disabling GTK application-id activation.
- Made Windows prefer PowerShell 7 (`pwsh.exe`) as the default shell when available.
- Added the fpasoterm executable directory to Windows child terminal `Path` so `fpasoterm` commands work inside the opened terminal.

## 1.2.1

- Fixed Windows direct binary CLI handling for `--help`, `--show-config`, window overrides, and shell selection.
- Added PowerShell 7 path fallback and shell value sanitization for `--shell pwsh.exe`.
- Added pull request review documentation for the no-artifact review path.

## 1.2.0

- Added runtime config application from inside a running terminal via OSC 777.
- Added visible runtime appearance examples and a default-appearance reset script.
- Added `terminal.termName = "xterm-256color"` and exported `TERM=xterm-256color` for tmux and other terminal multiplexers.
- Improved runtime terminal resizing after appearance and window setting changes.
- Improved ChromeOS launcher wrapper installation, update, and uninstall behavior.

## 1.1.0

- Added configurable custom titlebar titles and colors via config and one-shot CLI options.
- Added short CLI aliases for common launch options.
- Added custom titlebar minimize and maximize/restore controls.
- Documented titlebar options in English and Japanese.

## 1.0.5

- Fixed direct packaged app argument parsing so `fpasoterm.exe --shell pwsh.exe` selects the requested shell.
- Added direct app support for `--shell=value`, `--config <path>`, and `--config=<path>`.

## 1.0.4

- Fixed Windows launch behavior so normal GUI launches do not open an extra console window.
- Closed the application when the shell process exits, including `exit` from Windows shells.
- Added `terminal.shell` and `--shell <command>` for selecting shells such as bash, fish, PowerShell, or cmd.
- Avoided launching stale local Tauri target binaries after source changes.

## 1.0.3

- Fixed window size restore when launching the macOS `.app` bundle directly.

## 1.0.2

- Added ad-hoc macOS app signing and Release workflow verification for macOS `.app` and `.dmg` artifacts.
- Documented that full Gatekeeper-friendly macOS distribution still requires Developer ID signing and notarization.

## 1.0.1

- Included macOS Tauri rendering and resizing fixes in the release version.

## 1.0.0

- Added a tag-driven GitHub Release workflow that builds `artifacts/` in GitHub Actions and attaches the generated files to the release.
- Expanded release artifact generation to Linux x64, Linux arm64, macOS x64, macOS arm64, and Windows x64.
- Bumped the package version to `1.0.0` so release tag `v1.0.0` and generated artifact names match.

## 0.0.6

- Replaced the desktop runtime with Tauri and moved the PTY bridge to Rust using portable-pty.
- Kept the existing xterm.js terminal renderer, TOML config loader, plugin support, and CLI configuration commands.
- Added Linux/WebKitGTK transparency preparation and `--disable-dmabuf` diagnostics for ChromeOS/Baguette rendering issues.
- Removed runtime-specific launch options and old preload/main process files.

## 0.0.5

- Added documented known issues for ChromeOS/Baguette window placement and transparent terminal limitations.
- Removed unsupported window position CLI overrides after ChromeOS/Baguette testing showed the compositor keeps desktop runtime windows centered.
- Kept window size persistence while avoiding aggressive position reapplication that could freeze the OS during resize.
- Removed temporary transparency diagnostic CLI options and related runtime code.

## 0.0.4

- macOS Dock and bundle icons now use the generated project assets.
- Windows window icons now use the generated `.ico` asset.

## 0.0.3

- Initial fpasoterm release.
- Added xterm.js based terminal with a shell-backed PTY.
- Added Linux startup wrapper for the desktop runtime.
- Added npm binary `fpasoterm`.
- Added GitHub Actions checks and release artifact generation.
- Added application window icon wiring and close-on-shell-exit behavior.
- Added hicolor launcher icon generation and local desktop entry installation.
- Local desktop installation now also installs a `fpasoterm` command into the user's local bin directory.
- Added local desktop update and uninstall scripts for clean command, launcher, and icon management.
- Added `~/.config/fpasoterm/User/config.toml` support, JavaScript/TypeScript user plugins, and configurable IME duplicate-input guard timing.
- Added detached-by-default command launching plus `--help`, `--foreground`, `--config`, and window-size CLI overrides.
- Added `--show-config`, `--enable-plugin`, and `--disable-plugin` for configuration inspection and plugin management.
- Plugin enable/disable commands now accept file names, comma-separated lists, and repeated options.
- Added example TOML configs under `examples/config/`.
- Added full default configuration documentation and TypeScript plugin samples.
