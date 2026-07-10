# Installation

## npm

After the package is published, install the command from the npm registry:

```sh
npm install -g fpasoterm
fpasoterm
```

If your network makes npm's automatic audit request noisy, use `--no-audit` for local installs. CI still runs the explicit security checks in this repository.

## Development Build

```sh
npm install
./scripts/run
```

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

Remove the local command, launcher entry, and installed launcher icons:

```sh
npm run uninstall:desktop
```

To expose the local command during development:

```sh
npm link
fpasoterm
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

Regenerate launcher icon sizes after replacing `extra/logo/fpasoterm.png`:

```sh
npm run generate:icons
npm run update:desktop
```
