# Plugins

fpasoterm plugins are local JavaScript or TypeScript files that run in the
terminal renderer after the terminal is ready. Use them for small, personal
behavior changes such as a startup message, terminal option adjustment, or
diagnostic integration.

Prefer a plugin for a new convenience workflow instead of adding it to the
fpasoterm core. Core changes remain appropriate for terminal correctness,
platform integration, security, and compatibility with shells, multiplexers,
and TUI editors.

Plugins are an advanced local customization feature. They are not a sandboxed
extension format and are not downloaded by fpasoterm.

For reviewed public plugins, use the
[fpasoterm-plugins ports repository](https://github.com/oyoguhito/fpasoterm-plugins).
It owns the public catalog, port metadata, compatibility checks, local
install/update/uninstall commands, and contribution process. This document
defines the fpasoterm runtime contract and manual local plugin layout.

## Security

Plugins run in the renderer context alongside the terminal UI. Enable only
local files that you trust and have reviewed. Do not enable plugins copied from
unknown sources, and do not put passwords, access tokens, private paths, or
other secrets in a plugin file.

## Plugin directory

Place `.js` or `.ts` files below the `plugins` directory beside the active
`config.toml`:

```text
~/.config/fpasoterm/User/
├── config.toml
└── plugins/
    ├── welcome-banner.ts
    └── status-banner.ts
```

Subdirectories are supported. Plugin paths in the configuration are always
relative to the `User` directory, for example `plugins/team/banner.ts`.

TypeScript plugins are transpiled at launch and cached below:

```text
~/.config/fpasoterm/User/cache/plugins/
```

Do not edit generated files in that cache; edit the original `.ts` file in
`User/plugins` instead.

## Plugin version metadata

Plugins may declare their own version and description in source comments. No
manifest or extra directory is required:

```ts
// @fpasoterm-plugin version: 1.0.0
// @fpasoterm-plugin description: Displays a concise startup message.
```

`version` is an arbitrary local release identifier; use semantic versions such
as `1.0.0` for consistency. It is distinct from `api.version`, which is the
running fpasoterm application version. Omit the header for older plugins; the
CLI reports their version as `(not declared)`.

## Enable plugins

For a manually maintained local plugin, create the directory and enable its
trusted source in configuration:

```sh
mkdir -p ~/.config/fpasoterm/User/plugins
```

Enable the files in `~/.config/fpasoterm/User/config.toml`:

```toml
[plugins]
enabled = [
  "plugins/welcome-banner.ts",
  "plugins/status-banner.ts",
]
```

Restart fpasoterm after changing the plugin list or plugin source. Plugins are
loaded in the order written in `enabled`.

The CLI, including packaged Windows/macOS/Linux binaries, can update the list
by plugin filename:

```sh
fpasoterm --enable-plugin welcome-banner.ts,status-banner.ts
fpasoterm --disable-plugin status-banner.ts
fpasoterm --show-config
```

The explicit plugin-management spellings are also available from every CLI:

```sh
fpasoterm --plugin-path
fpasoterm --plugin-list
fpasoterm --plugin-info welcome-banner.ts
fpasoterm --plugin-enable welcome-banner.ts
fpasoterm --plugin-disable welcome-banner.ts
fpasoterm --plugin-enable-all
fpasoterm --plugin-disable-all
```

`--plugin-list` prints discovered files with their declared versions and the `enabled` entries. The
`--plugin-enable` and `--plugin-disable` options are aliases for the existing
`--enable-plugin` and `--disable-plugin` options.
`--plugin-info <file>` prints the resolved source path, enabled state, declared
version, description, load status, and renderer URL without opening a window. Pass a
`.js` or `.ts` filename such as `welcome-banner.ts`; an extensionless name is
not a valid selector.
`--plugin-enable-all` enables every discovered `.js`/`.ts` file. It reports an
error when `User/plugins` contains no plugin source; it never silently creates
or enables an empty list.
`--plugin-disable-all` clears only `plugins.enabled`; it does not delete any
plugin source or cache file.

When duplicate filenames exist in different subdirectories, use a path
relative to `plugins`, such as `team/status-banner.ts`.

### Windows packaged binary

The MSI/EXE does not copy public samples into the writable `User/plugins`
directory. Use the Windows source-checkout instructions in
[fpasoterm-plugins](https://github.com/oyoguhito/fpasoterm-plugins) to install
a reviewed port, or use `fpasoterm.cmd --plugin-path` to locate the directory
before manually placing trusted source.

At startup, plugin scripts are loaded from the trusted `User/plugins` source or
the generated TypeScript cache using Tauri's local asset protocol. The default
`User` directory is supported. After enabling or editing a plugin, close and
restart the affected fpasoterm window. For a load failure, start with
`fpasoterm --foreground --console-diagnostics` and look for `plugin loaded` or
`failed to load plugin`.

Every plugin is evaluated in its own function scope. Plugins can therefore use
their own top-level `const` and `let` declarations without colliding with other
enabled plugins. Use `window.fpasotermPluginApi` for the supported shared API.

## Plugin API

The supported API is declared in
[`docs/fpasoterm-plugin.d.ts`](fpasoterm-plugin.d.ts). Add this line at the top
of a TypeScript plugin when working from this repository:

```ts
/// <reference path="../../docs/fpasoterm-plugin.d.ts" />
```

Installed plugins can instead copy the declaration file locally and update the
reference path. The API is available as `window.fpasotermPluginApi` and
provides:

- `terminal`: write text, focus the terminal, and adjust supported terminal options.
- `fitAddon`: call `fit()` after a plugin changes terminal layout-related options.
- `config`: read the resolved runtime configuration, including `plugins.enabled`.
- `log(message)`: write a plugin-prefixed diagnostic entry.
- `version`: read the running fpasoterm version and build identifier.
- `onReady(callback)`: run code once after the terminal backend has started.
- `registerCommand(id, title, handler)`: add an action button under the
  hamburger menu's `Plugins` submenu. The submenu is shown only when at least
  one loaded plugin registers a command.
  of the existing hamburger menu.

Keep plugins small and defensive. A plugin load error is reported in diagnostics
and does not stop later enabled plugins from loading, but an invalid plugin can
still affect the renderer while it runs.

Registered commands use the existing menu's Tab and arrow-key navigation.
`Ctrl+Shift+P` remains assigned to `Log Show`; a command palette can reuse the
same command registry in a future release without changing plugin source.

## Samples And Ports

The in-tree `examples/plugins/` files are minimal API references. Installable
samples, appearance themes, metadata, compatibility validation, and updates are
maintained in [fpasoterm-plugins](https://github.com/oyoguhito/fpasoterm-plugins).

See [Configuration](config.en.md) for the full `config.toml` reference.
