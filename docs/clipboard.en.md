# Clipboard Flow and Test Matrix

This document records the clipboard paths used by fpasoterm and the results
actually observed on ChromeOS Linux/Crostini. It is a test matrix, not a claim
that every desktop has one unified clipboard.

## Ownership and responsibility

| Component | Copy responsibility | Paste responsibility |
| --- | --- | --- |
| fpasoterm | `Ctrl+Shift+c`, the Copy menu item, and selected terminal text write through its WebView and native backend paths. | `Ctrl+Shift+v`, the Paste menu item, and right-click Paste read the desktop clipboard and send text to the PTY. |
| herdr (local Linux session) | Copy mode and mouse selection write directly to a Linux provider: `wl-copy --type text/plain;charset=utf-8`, then `xclip` / `xsel` when available. | herdr has no separate pane-paste buffer shortcut; fpasoterm's `Ctrl+Shift+v` and other terminal/OS paste actions read the OS clipboard and send the input to the herdr pane. |
| Desktop application | Owns its normal system clipboard integration. | Owns its normal system clipboard integration. |
| OSC 52 | Terminal output may request a clipboard write. This is relevant to trusted remote/headless sessions. | It is not the normal local herdr copy path. |

On Crostini, WebView/ChromeOS shared clipboard, Wayland clipboard, and X11
selection ownership can diverge temporarily. A successful paste in one
application does **not** prove that every reader sees the same current value.

## Current ChromeOS Linux observations

Use a unique, non-sensitive marker for each row, for example `FPA-001`,
`HERDR-002`, and `EXT-003`. Do not test with passwords, tokens, or private
text.

| Copy source | Paste destination | Result | Status |
| --- | --- | --- | --- |
| fpasoterm copy | fpasoterm paste | Latest fpasoterm value pasted. Record the shortcut/menu operation in the next run. | OK in latest re-test |
| fpasoterm selection with `Ctrl+Shift+c` | Other desktop application | Latest fpasoterm value pasted. | OK in latest re-test |
| Other desktop application | fpasoterm with `Ctrl+Shift+v` | Latest external application value pasted. | OK in latest re-test |
| Other desktop application | herdr with `Ctrl+Shift+v` | Latest external application value pasted. | OK in latest re-test |
| herdr copy mode (`prefix`, `[`, select, `y`) | herdr with `Ctrl+Shift+v` | An existing external-application value, not the herdr value, is pasted. | NG in latest re-test (stale value) |
| herdr copy mode (`prefix`, `[`, select, `y`) | fpasoterm with `Ctrl+Shift+v` / other desktop application | Not re-tested in the current build. | Unconfirmed |
| Other desktop application | Other desktop application | Copy/paste available. | Confirmed OK (control) |
| Remote/headless program emitting OSC 52 | Local host clipboard | Test separately with trusted, non-sensitive text. | Out of scope for the local herdr failure |

## Required procedure before changing clipboard code

1. Start the current source, not a packaged artifact:

   ```sh
   bin/fpasoterm --close all
   bin/fpasoterm --dev --foreground --console-diagnostics
   ```

2. Run the complete matrix above with new marker values.
3. Record the exact failing row, fpasoterm version/commit, `DISPLAY`,
   `WAYLAND_DISPLAY`, and whether `wl-copy`, `wl-paste`, `xclip`, and `xsel`
   are installed.
4. Change only the path used by that failing row. Do not change reader priority
   globally until the unaffected rows have been re-tested. Record keyboard
   shortcuts and menu actions as separate paths.
5. Add the result to this table before making another clipboard change.

`terminal paste source=...` in Diagnostics identifies the reader selected by
fpasoterm. It intentionally never includes clipboard contents.

## Investigation, not a workaround

`wl-paste --list-types` and X11 `TARGETS` can identify available formats, but
they do not establish freshness when different clipboard owners disagree.
Record their results only while using a harmless test marker. On Crostini, an
`xclip` write can exit 0 without updating the ChromeOS/Chrome shared clipboard,
so its exit status alone does not prove that the host received the copy. Because
external application→herdr paste now works, fpasoterm's paste path and its input
to the herdr pane are not the investigation target. OSC 52 should not be enabled
as a blanket replacement for local clipboard integration: terminal output is
data, not automatically trusted clipboard authority.

For the herdr upstream implementation proposal derived from this issue, see
[Mirror Explicit herdr Copies through OSC 52](herdr-clipboard-mirroring-proposal.en.md).
