# FpasoTerm Specification

## Purpose

FpasoTerm is a desktop terminal application focused on Japanese input in ChromeOS Linux while keeping the architecture portable to other operating systems.

## Architecture

- The desktop runtime owns the application window and Chromium input method path.
- xterm.js renders the terminal UI in the renderer process.
- node-pty creates the shell-backed pseudoterminal in the main process.
- The renderer communicates with the main process through a narrow preload IPC API.

## ChromeOS Linux Input Policy

FpasoTerm does not intercept Japanese keyboard keys such as `かな` or `英数`. Input method switching and composition are delegated to Chromium and the operating system.

On Linux, FpasoTerm is launched with `--ozone-platform=x11` by default:

```text
--ozone-platform=x11
```

The ozone platform can be overridden:

```sh
FPASOTERM_OZONE_PLATFORM=wayland fpasoterm
```

The npm binary name is `fpasoterm`. The binary passes Chromium switches before the app path so Ozone is initialized correctly.

Users can install the published npm package directly:

```sh
npm install -g fpasoterm
```

The project icon is `extra/logo/fpasoterm.png`.

The package license is MIT and the repository must expose `bin.fpasoterm` from `package.json` for global installation.

## Diagnostics

Set `FPASOTERM_DEBUG_KEYS=1` to log key and composition events.

Diagnostics are written to:

```text
diagnostics/fpasoterm-debug.log
```

The debug panel also exposes a Copy button that uses the desktop runtime's clipboard API.

## Non-goals

- FpasoTerm does not manage IBus engines.
- FpasoTerm does not emulate OS-level Japanese input switching.
- FpasoTerm does not implement terminal shell behavior itself; that is delegated to the user's shell through node-pty.
