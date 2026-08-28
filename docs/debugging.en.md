# Debugging Guide

Use this guide when a platform-specific problem needs an event trace, such as
IME composition, clipboard handling, terminal rendering, or a window lifecycle
problem.

## Start From Current Source

Close every existing fpasoterm window, then force a local debug-binary rebuild.
This avoids testing an older packaged or cached binary.

```sh
mise exec node -- ./bin/fpasoterm --dev --foreground --debug-keys --console-diagnostics \
  2>&1 | tee ~/temp/fpasoterm-debug.log
```

`--dev` rebuilds the local debug binary from the current source. `--foreground`
keeps the launcher attached to the console. `--debug-keys` enables renderer key
and composition diagnostics, and `--console-diagnostics` mirrors them to stderr.

For a normal attached launch without forcing a rebuild:

```sh
fpasoterm --foreground --debug-keys --console-diagnostics
```

The persistent debug log is
`~/.config/fpasoterm/User/logs/fpasoterm-debug.log` unless the platform uses a
different configured user directory.

## IME Composition Trace

Reproduce the issue with at least two conversions. For example, convert and
confirm `日本語は`, then convert and confirm another phrase or enter punctuation.
After closing the app, extract only the IME and PTY-input lines:

```sh
grep -E 'renderer ime (compositionstart|compositionupdate|compositionend|beforeinput|input|keydown|cleared)|renderer terminal input' \
  ~/temp/fpasoterm-debug.log
```

Expected behavior is that each `renderer terminal input` payload contains the
newly committed text only. When investigating ChromeOS, compare the helper
textarea `value=` at `compositionstart` with the following
`compositionupdate`: a stale prior value must not be inherited by the new
composition.

Share the smallest contiguous trace that includes one successful conversion
and one failing conversion. Do not edit or normalize the event payloads: their
ordering is the evidence needed to diagnose the platform webview and xterm.js
interaction.

## Rendering And Window Diagnostics

Use this command for WebKitGTK rendering symptoms on ChromeOS/Baguette:

```sh
fpasoterm --disable-dmabuf --foreground --console-diagnostics
```

Use the titlebar menu's **Diagnostics > Font / Glyph Test** and
**Diagnostics > Capability Test** before reporting glyph, terminfo, truecolor,
OSC, bracketed-paste, or bell issues. See [Configuration and Diagnostics](diagnostics.en.md),
[Font and Glyph Diagnostics](font-diagnostics.en.md), and
[Terminal Capability Diagnostics](capability-diagnostics.en.md).

## Reporting Safely

Include the result of `fpasoterm --diagnostics` when useful, but review it
first. It can contain local paths, plugin names, shell output, and sync-folder
details. Never publish credentials, tokens, private commands, or terminal
output containing secrets.
