# Installation

Japanese version: [INSTALL.ja.md](INSTALL.ja.md).

## npm

After the package is published, install the command from the npm registry:

```sh
npm install -g fpasoterm
fpasoterm
```

If your network makes npm's automatic audit request noisy, use `--no-audit` for local installs. CI still runs the explicit security checks in this repository.
Check which version and build commit are on the command path:

```sh
fpasoterm --version
fpasoterm -v
```

On Windows, run `fpasoterm --version` after installing a newer `.exe` or `.msi`. If it still prints the old version, the old executable is still being launched from `Path`, the Start menu, or a pinned shortcut. Close running fpasoterm windows, install the newer package again, then start fpasoterm from the updated shortcut.

## Development Build

Linux development requires the Tauri/WebKitGTK system packages:

```sh
sudo apt install build-essential curl libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

```sh
npm install
./scripts/run
```

For quick behavior checks while developing, use the Tauri dev runtime:

```sh
./bin/fpasoterm --dev
```

This does not create release bundles. It also ignores an existing `src-tauri/target/release/fpasoterm`, so renderer and Tauri source changes are reflected without reinstalling the desktop entry.
Add `--foreground --console-diagnostics` only when you need logs in the current console.
The first `--dev` launch may still take a few minutes because Cargo has to create the Tauri debug binary. Later launches reuse that build cache.

Install a local `fpasoterm` command for this checkout:

```sh
npm run install:desktop
fpasoterm
```

The command is written to `~/.local/bin/fpasoterm` unless `XDG_BIN_HOME` is set.

Update an existing local command, launcher entry, and icon installation:

```sh
npm run update:desktop
```

Update an npm-installed package from the terminal:

```sh
fpasoterm --self-update
```

For a source checkout, update the checkout with your normal git or jj workflow,
then refresh the installed command, launcher entry, and icons:

```sh
fpasoterm --update-desktop
```

For a clean non-jj git checkout, this can be automated:

```sh
fpasoterm --self-update-checkout
```

Run `npm run update:desktop` after changing the checkout path, launcher icon, or installed command wrapper. It is not required for `./bin/fpasoterm --dev ...`.

To remove an npm global installation, including its npm-managed `fpasoterm`
command, run:

```sh
npm uninstall -g fpasoterm
```

This does not remove a source-checkout desktop launcher, user config, cache, or
app data. If `type -a fpasoterm` still shows a command afterward, it is another
installation such as a source-checkout launcher.

On Windows, run the same command in PowerShell or Command Prompt. Open a new
terminal afterward, then use `where.exe fpasoterm` or
`Get-Command fpasoterm -All` to check for another remaining command.

From a source checkout, remove its local command, desktop launcher entry,
installed launcher icons, user config, runtime cache, and Tauri/WebKit app data:

```sh
npm run uninstall:desktop
```

On Windows, `npm run uninstall:desktop` only removes fpasoterm-specific
directories from the current user's `Path` if they were added during local
testing. It does not remove the global npm package, source checkout, user
config, cache, or app data. Shared npm directories are left untouched.

To remove both installation types, run `npm run uninstall:desktop` from the
source checkout first, then run `npm uninstall -g fpasoterm`.

To expose the local command during development:

```sh
npm link
fpasoterm
```

If ChromeOS/Baguette shows black, white, or flickering surfaces during transparency testing, start with:

```sh
fpasoterm --disable-dmabuf
```

## Release Artifacts

To create artifacts for the current development machine:

```sh
npm run build:artifacts
```

Generated files are written to `artifacts/`. Source archives are always generated. Platform bundles depend on the current OS, so a local Linux build creates Linux packages only.

Tagged GitHub Releases build the broader release set in GitHub Actions:

- source package and portable source archive
- Linux x64 `.deb` / `.rpm`
- Linux arm64 `.deb` / `.rpm` for ChromeOS/Baguette and other arm64 Linux environments
- macOS x64 bundle
- macOS arm64 bundle
- Windows x64 bundle

Install the Debian package locally:

```sh
sudo apt install ./artifacts/fpasoterm_1.3.0_arm64-linux-arm64.deb
```

## Linux Desktop Entry

The desktop entry template is:

```text
extra/linux/io.github.oyoguhito.fpasoterm.desktop
```

The application icon is:

```text
extra/logo/fpasoterm.png
```

For macOS app bundles, use:

```text
extra/macos/fpasoterm.icns
```

For Windows app bundles, use:

```text
extra/windows/fpasoterm.ico
```

Install the desktop entry and hicolor launcher icons into the current user's data directory:

```sh
npm run install:desktop
```

For unpacked checkout installs, the installed desktop entry rewrites `Exec=` to
the absolute `~/.local/bin/fpasoterm` wrapper path and does not set `TryExec`.
The wrapper records the Node.js executable used during installation and also
falls back to common `node` paths. This avoids ChromeOS launcher failures when
the launcher environment does not include the user's shell `PATH`.

The installed desktop entry uses `StartupWMClass=fpasoterm` and
`Icon=io.github.oyoguhito.fpasoterm`. The GTK application id is disabled so
multiple fpasoterm windows can be started from the CLI or launcher while the
launcher still resolves the fpasoterm shelf icon and hover name. The installer
writes both `io.github.oyoguhito.fpasoterm.png` and `fpasoterm.png` icon names
into the hicolor icon theme.

Regenerate launcher icon sizes after replacing `extra/logo/fpasoterm.png`:

```sh
npm run generate:icons
npm run update:desktop
```
