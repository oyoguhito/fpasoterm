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
extension format. fpasoterm downloads a public port only when the user
explicitly invokes `--plugin-install`; it never downloads plugins at startup
or automatically from a renderer plugin.

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

fpasoterm creates `User/plugins` on its first normal launch. For a manually
maintained local plugin, place its trusted source there and enable it in
configuration.

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
fpasoterm --plugin-info welcome-banner
fpasoterm --plugin-uninstall welcome-banner
fpasoterm --plugin-enable welcome-banner
fpasoterm --plugin-disable welcome-banner
fpasoterm --plugin-enable-all
fpasoterm --plugin-disable-all
```

`--plugin-list` is a local-only view of the active `User/plugins` directory. It does not query
GitHub or the public port catalog; use `--plugin-search [query]` for that remote catalog. It
prints discovered files with their declared versions and the `enabled` entries. The
`--plugin-enable` and `--plugin-disable` options are aliases for the existing
`--enable-plugin` and `--disable-plugin` options.
`--plugin-info <file>` prints the resolved source path, enabled state, declared
version, description, load status, and renderer URL without opening a window. Pass a
`.js` or `.ts` filename such as `welcome-banner.ts`. For all local
`--plugin-*` selectors, the leading `plugins/` and the `.js`/`.ts` suffix are
optional: use `welcome-banner` or `appearance/teal`. If both `.js` and `.ts`
would match, provide an extension or a more specific path.
`--plugin-uninstall <file>` removes one or comma-separated local plugin source
files from `User/plugins`, removes their generated cache files, and removes the
same entries from `plugins.enabled`. It never contacts the public catalog and
refuses ambiguous names, traversal, and symlinked plugin files. Restart open
fpasoterm windows after removal. It cannot be combined with other plugin
mutation options.
`--plugin-enable-all` enables every discovered `.js`/`.ts` file. It reports an
error when `User/plugins` contains no plugin source; it never silently creates
or enables an empty list.
`--plugin-disable-all` clears only `plugins.enabled`; it does not delete any
plugin source or cache file.

## Public Port Install

Search the public metadata index before selecting a port. This requests only
the official `INDEX`; it does not download or execute plugin source:

```sh
fpasoterm --plugin-search
fpasoterm --plugin-search teal
```

`--plugin-search` is a **remote** search and prints its source as the official
GitHub `INDEX`. For a local checkout that you want to review or modify, use
`npm run ports -- search <query>` from `fpasoterm-plugins`; its `install` and
`update` commands copy only from that local checkout. This keeps remote direct
install and local reviewed-copy workflows distinct.

Download one selected port from the official
[`oyoguhito/fpasoterm-plugins`](https://github.com/oyoguhito/fpasoterm-plugins)
repository without cloning its full checkout or installing Node.js:

```sh
fpasoterm --plugin-install appearance/teal
fpasoterm --plugin-install appearance/teal --enable
fpasoterm --plugin-uninstall appearance/teal
```

The first command copies only the requested source into `User/plugins` and
leaves it disabled for review. `--enable` explicitly adds it to
`plugins.enabled`. Existing files are preserved unless
`--plugin-install-force` is supplied. The installer connects over HTTPS only to
the fixed official repository, validates port/source paths, manifest metadata,
source size, and the expected fpasoterm plugin header. Downloaded plugins still
run in the renderer, so review and trust them before enabling them.

When duplicate filenames exist in different subdirectories, use a path
relative to `plugins`, such as `team/status-banner.ts`.

### Windows packaged binary

MSI/EXE supports `fpasoterm.exe --plugin-install <category/name>` directly;
Node.js and a source checkout are not required. Use `fpasoterm.cmd` only when
running from a Windows source checkout.

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
  one loaded plugin registers a command. Enabling a plugin alone does not add a
  button because fpasoterm has no action handler to invoke.

All current in-tree samples register one command, so enabling current copies of
`hello.ts`, `status-banner.ts`, `theme.ts`, and `welcome-banner.ts` shows four
buttons. If an older local sample does not register a command, it remains
enabled and can still run its startup code, but it is intentionally absent from
the menu. Use `--plugin-info <file>` to inspect its source/version and restart
after replacing a local plugin file.

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
