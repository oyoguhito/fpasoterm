# Terminal Capability Diagnostics

Open the window menu, then select **Diagnostics > Capability Test**. This
opens the existing diagnostics panel and does not change the terminal session,
shell configuration, or saved settings.

The panel reports the environment fpasoterm provides to its PTY:

- `TERM`: `xterm-256color`
- `COLORTERM`: `truecolor`
- `locale`: the effective `LC_ALL`, `LC_CTYPE`, or `LANG` value
- `output encoding`: the configured PTY decoder
- `shell`: the configured or platform-selected shell command

## Output Encoding

The panel can save `terminal.encoding` as `utf-8`, `shift-jis`, or `euc-jp`.
The choice applies when the window is restarted because both the PTY decoder and
shell locale are selected before the shell starts. UTF-8 is the default. On
Unix, fpasoterm supplies a UTF-8 locale to an inherited non-UTF-8 environment,
so normal tools keep UTF-8 filenames intact. It does not auto-detect byte
encodings because detection is ambiguous and can corrupt otherwise valid text.

## Truecolor

The renderer supports 24-bit ANSI colors and advertises that through
`COLORTERM=truecolor`. Run the command shown in the panel in the terminal. It
should render distinct red, green, and blue words:

```sh
printf '\033[38;2;255;80;80mred \033[38;2;80;220;140mgreen \033[38;2;90;150;255mblue\033[0m\n'
```

## Control Sequences

- **OSC 52 clipboard:** fpasoterm accepts received text clipboard payloads and
  writes them to the operating-system clipboard when `security.osc52` is
  `trusted`. `security.osc52MaxBytes` limits the decoded payload. Set
  `security.osc52 = "disabled"` when terminal output is not trusted.
- **OSC 7 current directory:** received `file://` reports are retained only as
  diagnostics metadata. Use `Ctrl+Shift+o` or **Window > New CWD** to open a
  separate terminal in an existing local absolute directory reported by OSC 7.
  Remote-host reports and unavailable paths are rejected. fpasoterm does not
  open, inspect, or synchronize the reported path. fpasoterm configures Bash
  to report OSC 7 at each prompt; other shells need their own OSC 7 integration.
- **OSC 133 shell integration:** prompt and command lifecycle markers are
  retained only as diagnostics metadata. They do not execute a command or
  replace the shell, multiplexer, or TUI workflow.
- **OSC 8 hyperlinks:** clicking a rendered OSC 8 link or plain `http(s)` URL
  opens an explicit confirmation dialog. Copy remains available. External
  browser opening is disabled by default and additionally requires
  `security.osc8Open = true`; links are never opened automatically. Absolute
  and `~/` paths remain copy-only links.
- **OSC 9 / OSC 99 notifications:** desktop notifications are disabled by
  default. Set `security.oscNotifications = true` to allow them. The first use
  can request operating-system notification permission, and
  `security.oscNotificationMinIntervalMs` limits notifications to one per
  1,000--60,000 ms (default 5,000 ms).
- **Bracketed paste:** xterm.js handles terminal input. A shell or TUI enables
  bracketed paste with DECSET 2004, then receives pasted text as a bracketed
  sequence.
- **Bell:** BEL is passed to xterm.js. Audible or visual feedback is controlled
  by the operating system and webview, so it may be silent.

The panel documents the supported paths rather than sending a clipboard write,
opening a URL, or ringing a bell automatically. This keeps diagnostics safe for
the current terminal session.

## Verification

1. Start fpasoterm and open **Diagnostics > Capability Test**.
2. Confirm `TERM` is `xterm-256color` and `COLORTERM` is `truecolor`.
3. Run the displayed truecolor command and confirm all three colors differ.
4. Run `printf 'https://example.com /tmp/fpasoterm-link-test\n'`, click each
   item, and paste into a trusted text field to confirm URL/path copying.
5. If a TUI behaves differently, record this panel together with
   `fpasoterm --diagnostics` when filing an issue.
