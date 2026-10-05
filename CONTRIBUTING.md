# Contributing

Thank you for improving fpasoterm.

## Development

Install Node.js 22+, Rust stable, and the native build prerequisites for the
target operating system before running the commands below.

- Linux: `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`,
  `libayatana-appindicator3-dev`, and `librsvg2-dev`.
- macOS: Xcode Command Line Tools (`xcode-select --install`).
- Windows: Visual Studio Build Tools with **Desktop development with C++** and
  the Microsoft Edge WebView2 Runtime.

On Debian, Ubuntu, or ChromeOS Linux, install the Linux prerequisites with:

```sh
sudo apt-get install -y build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

`libwebkit2gtk-4.1-dev` supplies the `libsoup-3.0` and
`javascriptcoregtk-4.1` pkg-config metadata required by Tauri. If Cargo reports
that `soup3-sys` or `javascriptcore-rs-sys` cannot find those libraries, install
the package above; do not set `PKG_CONFIG_PATH` unless using a deliberately
nonstandard library installation. Verify it with:

```sh
pkg-config --modversion libsoup-3.0 javascriptcoregtk-4.1
```

```sh
npm ci
npm run check
node ./bin/fpasoterm --dev
```

On Windows PowerShell, use the same launcher command with backslashes:

```powershell
node .\bin\fpasoterm --dev
```

Normal launcher invocations return the prompt immediately and print whether a
cached runtime is used or Cargo is building one. Use
`--foreground --console-diagnostics` only when waiting for compiler and
desktop-process output is intentional.

For IME, rendering, clipboard, and window issues, follow the forced rebuild,
event-trace, and safe-reporting workflow in [docs/debugging.en.md](docs/debugging.en.md).
Japanese contribution guidance is available in [CONTRIBUTING.ja.md](CONTRIBUTING.ja.md).

### Verify Plugin activity UI

The unit test covers successful, failed, and missing plugin commands. The
checked-in `examples/plugins/plugin-activity-test.ts` provides the equivalent
repeatable UI check, so do not create a temporary plugin or depend on an
incidental RDP/network failure. Install it into the trusted local plugin
directory, enable it, and restart the local development runtime:

```sh
node ./bin/fpasoterm --plugin-install-file examples/plugins/plugin-activity-test.ts --enable
node ./bin/fpasoterm --dev
```

First choose **Test Plugin Activity Success** from the Plugin menu. It must
write its completion line to the terminal and return terminal focus; this is the
normal-path check. Then choose **Test Plugin Activity Error**. Confirm that the
error panel appears, select **Close**, and verify that the panel disappears and
terminal keyboard input works immediately. Remove the installed example when
the checks are complete:

```sh
node ./bin/fpasoterm --plugin-uninstall plugin-activity-test.ts
```

The example is committed for development verification, but should not normally
remain enabled in an end-user configuration.

### Verify Kitty graphics and terminal-browser

`npm run check` includes bounded Kitty renderer unit coverage for PNG decode,
stale asynchronous-frame eviction, and suppressing a decode result or terminal
response when it completes after reset. In the real WebView, start
terminal-browser and verify its initial image, continuous frames, window
resize, title-bar zoom, and that **Ctrl+Q** returns to the shell and removes the
zoom controls.

For the Herdr path, also verify that `HERDR_PANE_ID` is non-empty and that
Herdr has applied `[terminal] kitty_graphics = true`. This setting lets
Herdr pass the Kitty sequence to the outer fpasoterm; it is not an fpasoterm
setting. See [Terminal Graphics](docs/config.en.md#terminal-graphics).

## Pull Request Review

Do not review a tagged release asset when the requested change is in a pull
request. Check out the pull request revision, build it on the target OS, and
launch it through the Node launcher:

```sh
gh pr checkout <number> --repo oyoguhito/fpasoterm
npm ci
npm run check
node ./bin/fpasoterm
```

Detailed Windows MSI/direct-binary and macOS app-bundle procedures are in
[docs/pr-review.en.md](docs/pr-review.en.md). Japanese review instructions are
available in [docs/pr-review.ja.md](docs/pr-review.ja.md).

Before submitting changes, run:

```sh
npm run check
npm run scan:secrets
desktop-file-validate extra/linux/io.github.oyoguhito.fpasoterm.desktop
npm run build:artifacts
```

## Scope

- Keep terminal rendering delegated to xterm.js and shell integration delegated to the backend PTY.
- Keep IME switching delegated to the platform webview and the operating system.
- Keep public documentation in both English and Japanese when user-facing behavior changes.
