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
`--self-update` suggestion only after reviewing the report. Standalone bundled
binaries run the config and update checks but report npm audit as unavailable,
because they do not include an npm package manifest.

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

`--copy-diagnostics` writes the same Markdown to the operating-system text
clipboard. It uses the native Windows clipboard, `pbcopy` on macOS, and
`wl-copy`, `xclip`, or `xsel` on Linux. It returns an error if no supported
clipboard provider is available.

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
