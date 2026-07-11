# Changelog

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
- Added xterm.js and node-pty based terminal.
- Added Linux startup wrapper with `--ozone-platform=x11` by default.
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
