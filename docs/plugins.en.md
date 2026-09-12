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
It owns the public catalog, `INDEX`, development checks, and contribution
process. End users install a reviewed local checkout or an explicit local
plugin file through the fpasoterm CLI; this document defines that runtime
contract and manual local plugin layout.

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

Plugins that use `openWebPanel` must also declare their HTTPS frame origins:

```ts
// @fpasoterm-plugin allowed-origins: https://www.youtube-nocookie.com
```

The declaration is a capability request, not an unrestricted permission.
fpasoterm grants it only when the origin is in its reviewed application
allowlist and CSP. Invalid origins grant no access.

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
fpasoterm --enable-plugin welcome-banner,status-banner
fpasoterm --disable-plugin status-banner
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
GitHub `INDEX`. The `fpasoterm-plugins` `ports` command remains useful for
local `INDEX` search, port development, and validation. It is not required for
an end-user install.

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
`--force` is supplied. The installer connects over HTTPS only to
the fixed official repository, validates port/source paths, manifest metadata,
source size, and the expected fpasoterm plugin header. Downloaded plugins still
run in the renderer, so review and trust them before enabling them.

### Local checkout or file install

To install a port you have cloned, reviewed, or are developing locally, use
the fpasoterm CLI directly. No `npm run ports install` step is needed:

```sh
git clone https://github.com/oyoguhito/fpasoterm-plugins.git
fpasoterm --plugin-install appearance/teal \
  --plugin-ports-dir ./fpasoterm-plugins --enable

# A checkout root or its ports/ directory is accepted; ports may be comma-separated.
fpasoterm --plugin-ports-dir ./fpasoterm-plugins/ports \
  --plugin-install integration/doom-wad-inspector,integration/doom-wasm-local --enable
```

`--plugin-ports-dir` explicitly selects either the checkout containing `ports/`
or that `ports/` directory itself. `--plugin-install` accepts one or more
comma-separated port IDs.
Without it, `--plugin-install` obtains the selected port from the official
GitHub repository. With it, the installer reads `port.toml`, checks metadata
and the minimum fpasoterm version, then copies only that local plugin source.
The local path never contacts the network.

For a standalone trusted plugin outside a ports checkout, explicitly name the
source file:

```sh
fpasoterm --plugin-install-file ~/work/my-plugins/team-banner.ts --enable
```

Both local commands require a regular `.js` or `.ts` file with the fpasoterm
plugin header and renderer API marker. They preserve an existing destination
unless `--force` is supplied.

When duplicate filenames exist in different subdirectories, use a path
relative to `plugins`, such as `team/status-banner.ts`.

### Windows packaged binary

MSI/EXE supports `fpasoterm.exe --plugin-install <category/name>` with or
without `--plugin-ports-dir`, and `--plugin-install-file` directly; Node.js is
not required. Use `fpasoterm.cmd` only when running from a Windows source checkout.

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
- `readClipboard()` / `writeClipboard(text)`: read or write plain UTF-8 text
  through fpasoterm's native clipboard bridge.
- `openExternalUrl(url)`: open an explicit HTTP(S) URL in the external browser.
  Call it only from a user-initiated action; fpasoterm validates the scheme and
  plugins must clearly explain when text is sent to an external service.
- `selectLocalAsset({ accept, maxBytes })`: show the native file picker from a
  direct user action and return the selected asset's name, media type, size,
  and in-memory `ArrayBuffer`. It never returns a filesystem path, directory
  handle, or persistent read permission. The maximum request is 64 MiB;
  cancellation returns `null`.
- `openCanvasOverlay({ title, width, height })`: open a focus-trapped, keyboard
  accessible canvas modal. It returns the canvas plus
  `close()` and `focus()`. Escape, the Close button, and clicking the backdrop
  close the modal and return focus to the terminal.
- `openWebPanel({ title, url, width, height })`: open a focus-trapped HTTPS
  iframe panel for an origin declared with `allowed-origins` and approved by
  fpasoterm. The call must be a direct user action; the panel can be closed
  with Escape, Close, or its backdrop. It is not a general-purpose browser.
- `getOfficialPluginIndex()`: read metadata from the same fixed official `INDEX`
  used by `fpasoterm --plugin-search`. It does not download, install, enable,
  or execute plugin source.
- `onReady(callback)`: run code once after the terminal backend has started.
- `registerCommand(id, title, handler)`: add an action button under the
  hamburger menu's `Plugins` submenu. The submenu is always available and
  includes a built-in `Plugin Catalog` action. Enabling a plugin alone does not
  add a button because fpasoterm has no action handler to invoke.

The same registered command can be invoked during a new GUI launch from the
local CLI. This dispatches only the command ID after enabled plugins load; it
does not evaluate JavaScript supplied on the command line.

```bash
fpasoterm --plugin-run youtube-web-panel
fpasoterm --plugin-run example.action --plugin-args '{"query":"doom"}'
```

`--plugin-args` accepts one JSON value up to 16 KiB and is provided as the
handler's first argument. A missing value is `null` for CLI invocation; menu
invocation continues to pass `undefined`. Commands that open dialogs, pickers,
or panels still require and display the normal GUI.

All current in-tree samples register one command, so enabling current copies of
`hello.ts`, `status-banner.ts`, `theme.ts`, and `welcome-banner.ts` shows four
buttons. If an older local sample does not register a command, it remains
enabled and can still run its startup code, but it is intentionally absent from
the menu. `Plugin Catalog` only displays official port metadata and install
commands; it does not download, install, enable, or execute plugin source. Use
`--plugin-info <file>` to inspect a local plugin's source/version and restart
after replacing a local plugin file.

`Plugin Catalog` fetches the official `INDEX` when opened. Its search field
filters the already fetched entries by port ID, name, author, and description;
it does not make an additional request or install a plugin.

Keep plugins small and defensive. A plugin load error is reported in diagnostics
and does not stop later enabled plugins from loading, but an invalid plugin can
still affect the renderer while it runs.

Do not use these APIs to build a general filesystem browser or downloader.
Ask the user to choose every asset, validate its format and size before use,
and keep it in memory only for the active plugin session.

[`examples/plugins/local-asset-canvas.ts`](../examples/plugins/local-asset-canvas.ts)
is a small image-preview example: it opens the canvas first, then lets the user
click the canvas to select one image. This order preserves the browser's
user-activation requirement for the file chooser.

Registered commands use the existing menu's Tab and arrow-key navigation.
`Ctrl+Shift+p` is reserved for a future command palette, which can reuse the
same command registry in a future release without changing plugin source.

## Samples And Ports

The in-tree `examples/plugins/` files are minimal API references. Installable
samples, appearance themes, metadata, compatibility validation, and updates are
maintained in [fpasoterm-plugins](https://github.com/oyoguhito/fpasoterm-plugins).

See [Configuration](config.en.md) for the full `config.toml` reference.
