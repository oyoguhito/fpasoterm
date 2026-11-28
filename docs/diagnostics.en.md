# Configuration And Diagnostics

These commands inspect local state only. They do not open a terminal window or
modify `config.toml`.

## Configuration

```sh
fpasoterm --config-path
fpasoterm --config-example > config.toml
fpasoterm --config-check
fpasoterm --config ~/.config/fpasoterm/User/work.toml --config-check
```

`--config-path` prints the selected `config.toml` path. `--config-example`
prints the complete default TOML for the current platform. Redirect it only to
a new file; use `--reset-config` when a backup of an existing config is needed.

`--config-check` parses the selected TOML and reports warnings without changing
it. A TOML syntax error returns exit status `1`; warnings keep exit status `0`
because fpasoterm can still use defaults for omitted settings. Checks include
positive numeric settings, `plugins.enabled` entries that are invalid or
missing, and unsupported keys that `--prune-config` would remove.

## Doctor

```sh
fpasoterm --doctor
```

`--doctor` is read-only. The Node launcher validates the selected config,
compares the installed version with npm `latest`, and runs `npm audit --omit=dev`.
It never installs an update or changes configuration; follow its explicit
`--self-update` suggestion only after reviewing the report when using the Node
launcher. Standalone bundled binaries run the config and update checks but do
not support `--self-update`; when an update is available they direct users to
the GitHub Release download page. They report npm audit as unavailable because
they do not include an npm package manifest.

On Linux, the Node launcher also checks an available native runtime with `ldd`.
If a GUI-only launch cannot load WebKitGTK, `--doctor` reports the missing
shared library and an explicit Debian/Ubuntu/ChromeOS repair command. The
launcher never installs packages itself. When a desktop launch detects a
missing library before it opens a window, it records the same result in
`~/.cache/fpasoterm/launcher.log` and makes a best-effort desktop notification.

## Diagnostics Report

```sh
fpasoterm --diagnostics
fpasoterm --diagnostics > fpasoterm-diagnostics.md
fpasoterm --copy-diagnostics
```

`--diagnostics` prints Markdown intended for a GitHub Issue. It contains the
version and build commit, operating system and architecture, config path and
status, enabled plugins, configured or saved terminal size, font size, logging
path, sync state, and debug-log path. Review the output before posting it:
plugin names and local paths may be private.
On Linux it also contains the same read-only native-runtime dependency check as
`--doctor`.

`--copy-diagnostics` writes the same Markdown to the operating-system text
clipboard. It uses the native Windows clipboard, `pbcopy` on macOS, and
`wl-copy`, `xclip`, or `xsel` on Linux. It returns an error if no supported
clipboard provider is available.

## In-window Diagnostics versus terminal recording

**Diagnostics Log** in the window menu is a live, bounded view of fpasoterm
runtime events (for example renderer, input, plugin, and graphics-receiver
events). It is not a transcript of the terminal pane and it is not a file
recorder. Start the application with `--debug-keys` or
`--console-diagnostics` when an event trace is needed. The view keeps at most
1,000 saved lines for the running window.

- **Freeze display** holds the currently displayed snapshot so it can be
  searched or copied. It does **not** stop collection; newly received runtime
  events remain in memory. **Show live** returns to the newest events.
- **Erase saved diagnostics** removes that window's in-memory history and
  returns to the live display. It does not erase the persistent debug file.
- **Copy saved diagnostics** copies the in-memory history, including lines
  hidden by the search filter.

The **Log Start** / **Log Stop** menu action is different: it starts or stops a
durable terminal-output recording file in the configured logging directory.
It exists to choose the file-recording interval. Diagnostics has no equivalent
start/stop switch because its producers are controlled by the process debug
options; freezing its display is intentionally not a recording stop.

When a multiplexer such as Herdr is in use, fpasoterm can observe only the
outer PTY bytes and graphics events that Herdr actually forwards. It cannot
turn Diagnostics or a terminal log into a complete child-pane transcript,
attribute every byte to a pane, or prove that a control sequence was consumed
inside Herdr. For Kitty troubleshooting, use the application's own sender
report as well (`fpasobrowser --debug`, then `d` / `D` / `C`): that report can
confirm what fpasobrowser emitted, while it cannot claim that Herdr or the
receiver rendered it.

## Logs

```sh
fpasoterm --open-log-dir
```

The command creates the configured terminal-log directory if necessary, opens
it in the platform file manager, and prints its path. The default is
`~/.config/fpasoterm/User/logs`; `[logging].directory` overrides it. The debug
log is always `fpasoterm-debug.log` below the local `User/logs` directory.

The npm launcher and direct packaged binaries support these commands. On a
headless machine, use the printed path rather than `--open-log-dir`.
