# Plugins

fpasoterm plugins are local JavaScript or TypeScript files that run in the
terminal renderer after the terminal is ready. Use them for small, personal
behavior changes such as a startup message, terminal option adjustment, or
diagnostic integration.

Plugins are an advanced local customization feature. They are not a sandboxed
extension format and are not downloaded by fpasoterm.

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

## Enable plugins

Create the directory and copy one or both public samples from this repository:

```sh
mkdir -p ~/.config/fpasoterm/User/plugins
cp examples/plugins/welcome-banner.ts ~/.config/fpasoterm/User/plugins/
cp examples/plugins/status-banner.ts ~/.config/fpasoterm/User/plugins/
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

The Node launcher can also update the list by plugin filename:

```sh
fpasoterm --enable-plugin welcome-banner.ts,status-banner.ts
fpasoterm --disable-plugin status-banner.ts
fpasoterm --show-config
```

The explicit plugin-management spellings are also available from the Node
launcher:

```sh
fpasoterm --plugin-path
fpasoterm --plugin-list
fpasoterm --plugin-info welcome-banner.ts
fpasoterm --plugin-enable welcome-banner.ts
fpasoterm --plugin-disable welcome-banner.ts
fpasoterm --plugin-enable-all
fpasoterm --plugin-disable-all
```

`--plugin-list` prints both discovered files and the `enabled` entries. The
`--plugin-enable` and `--plugin-disable` options are aliases for the existing
`--enable-plugin` and `--disable-plugin` options.
`--plugin-info <file>` prints the resolved source path, enabled state, leading
source comment, load status, and renderer URL without opening a window. Pass a
`.js` or `.ts` filename such as `welcome-banner.ts`; an extensionless name is
not a valid selector.
`--plugin-enable-all` enables every discovered `.js`/`.ts` file.
`--plugin-disable-all` clears only `plugins.enabled`; it does not delete any
plugin source or cache file.

When duplicate filenames exist in different subdirectories, use a path
relative to `plugins`, such as `team/status-banner.ts`.

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
- `registerCommand(id, title, handler)`: add an action to the `Plugins` section
  of the existing hamburger menu.

Keep plugins small and defensive. A plugin load error is reported in diagnostics
and does not stop later enabled plugins from loading, but an invalid plugin can
still affect the renderer while it runs.

Registered commands use the existing menu's Tab and arrow-key navigation.
`Ctrl+Shift+P` remains assigned to `Log Show`; a command palette can reuse the
same command registry in a future release without changing plugin source.

## Samples

- [`examples/plugins/welcome-banner.ts`](../examples/plugins/welcome-banner.ts)
  prints a short startup banner and records a diagnostic message.
- [`examples/plugins/status-banner.ts`](../examples/plugins/status-banner.ts)
  adds `Show Plugin Status` to the `Plugins` menu section.
- [`examples/plugins/theme.ts`](../examples/plugins/theme.ts)
  applies a visible teal terminal palette and prints a confirmation after startup.

See [Configuration](config.en.md) for the full `config.toml` reference.
