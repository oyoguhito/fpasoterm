# Changelog

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
