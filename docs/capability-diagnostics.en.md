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
  writes them to the operating-system clipboard. It is intended for trusted
  local tools such as tmux, screen, byobu, and herdr.
- **OSC 8 hyperlinks:** sequences pass through to xterm.js. Visual rendering
  and opening a link depend on the platform webview; do not use it as a
  security boundary.
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
4. If a TUI behaves differently, record this panel together with
   `fpasoterm --diagnostics` when filing an issue.
