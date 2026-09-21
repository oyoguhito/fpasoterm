# Proposal: Mirror Explicit herdr Copies through OSC 52

This is an implementation and test note for a proposed upstream herdr change.
It does not change herdr from this repository. The inspected herdr revision is
[`100cda3c`](https://github.com/herdrdev/herdr/tree/100cda3c).

## Problem

On ChromeOS Linux/Crostini, a local herdr copy can reach a container-native
Wayland or X11 clipboard without reaching the ChromeOS/Chrome shared clipboard.
This makes the next terminal paste use an older value that originated in an
external application.

| Path | Observed result |
| --- | --- |
| fpasoterm → external application | Works |
| external application → fpasoterm | Works |
| external application → herdr pane through fpasoterm Paste | Works |
| herdr copy mode → herdr pane through fpasoterm Paste | Fails; an earlier external value is pasted |

The test environment had `DISPLAY=:0`, `WAYLAND_DISPLAY=wayland-0`, and no
`SSH_CONNECTION`, `SSH_TTY`, `VSCODE_IPC_HOOK_CLI`, or WSL marker. Therefore
herdr's existing SSH/VS Code Remote/WSL OSC 52 preference was not active.

After an explicit herdr copy, `wl-paste` did not receive a response within
three seconds and X11 inspection still exposed the earlier external value. A
manual `xclip` writer can return success in this environment without proving
that the ChromeOS/Chrome shared clipboard changed. Native command exit status
is therefore not a host-clipboard delivery guarantee on Crostini.

## Existing behavior

In [`src/selection.rs`](https://github.com/herdrdev/herdr/blob/100cda3c/src/selection.rs#L337-L368),
`write_osc52_bytes()` currently does this:

1. In a non-SSH/non-WSL/non-VS Code Remote environment, it calls
   `platform::write_clipboard(bytes)`.
2. If that native call reports success, it returns without emitting OSC 52.
3. Otherwise it emits a BEL-terminated OSC 52 sequence to stdout.

On Linux, [`src/platform/linux.rs`](https://github.com/herdrdev/herdr/blob/100cda3c/src/platform/linux.rs#L978-L1000)
tries `wl-copy` when `WAYLAND_DISPLAY` is set, then `xclip` and `xsel` when
`DISPLAY` is set. This is a sensible native-first policy, but a native provider
may be isolated from the host shared clipboard in Crostini.

fpasoterm already receives trusted OSC 52 terminal output and writes it through
its GTK clipboard path. That path is the one that reaches the shared clipboard
for ordinary fpasoterm Copy/Paste in this environment.

## Proposed change

For a clipboard write that herdr has already accepted, preserve the existing
native write and additionally mirror the same bytes as OSC 52:

```text
explicit herdr Copy
        ├─ native provider(s): wl-copy / xclip / xsel
        └─ OSC 52 stdout mirror
                 └─ supporting terminal (for example fpasoterm)
                    synchronizes its host clipboard
```

The OSC 52 mirror must not depend on the native write returning failure. It is
a second delivery route, not a fallback. A terminal that does not support OSC
52 continues to receive the existing native behavior. A terminal that supports
both paths receives the same explicit copy value twice; this is idempotent.

Conceptually, the current early return becomes:

```rust
if !should_prefer_osc52() {
    let _ = crate::platform::write_clipboard(bytes);
}
emit_osc52_to_stdout(bytes);
```

The production patch should keep the existing `osc52_sequence()` encoding,
`BEL` terminator, and stdout flush. It should not fabricate SSH environment
variables or select a provider based on the terminal name.

## Scope and security

- Apply this only to herdr's existing clipboard-write action. That action is
  already authorized by an explicit user selection/copy operation or by the
  existing trusted clipboard-forwarding route.
- Do not add a fpasoterm rule that automatically treats arbitrary terminal
  output as browser clipboard authority. WebView clipboard writes remain
  subject to user-gesture and `security.osc52` policy.
- Do not remove native clipboard support. It remains the best route for normal
  local Linux terminal applications and unsupported terminals.
- Keep herdr's existing payload limits and encoding behavior. If a new mirror
  size limit is added, document it and apply it consistently to the existing
  OSC 52 fallback as well.

## Suggested upstream tests

Refactor the delivery decision enough to make these assertions testable without
depending on a real desktop clipboard:

1. Local environment, native write succeeds: native writer is called once and
   the expected BEL-terminated OSC 52 sequence is emitted.
2. Local environment, native write fails: native writer is attempted once and
   the same OSC 52 sequence is emitted.
3. SSH, VS Code Remote, and WSL preference environments: native writer is
   skipped as today and OSC 52 is emitted.
4. Empty and Unicode selections preserve the current bytes and base64 encoding.

A small helper that accepts a native-write closure and an output writer is
preferable to tests that capture process stdout globally.

## Manual acceptance test

Use unique non-sensitive markers. Do not copy terminal output to report a
result before testing the destination; doing so overwrites the clipboard.

1. Launch the fpasoterm source build with console diagnostics:

   ```sh
   bin/fpasoterm --close all
   bin/fpasoterm --dev --foreground --console-diagnostics
   ```

2. Run herdr in a fpasoterm terminal and copy `HERDR-OSC52-CHECK-001` using
   herdr's normal copy mode.
3. Verify fpasoterm emits both diagnostics (without exposing clipboard text):

   ```text
   OSC 52 clipboard received bytes=...
   OSC 52 clipboard wrote bytes=...
   ```

4. Before selecting or copying anything else, paste into another herdr pane
   through fpasoterm Paste and into an external desktop application. Both must
   receive `HERDR-OSC52-CHECK-001`.
5. Repeat on a non-Crostini Linux desktop to confirm that native clipboard
   behavior remains intact and no error is shown when OSC 52 is unsupported.

## PR summary text

> Mirror accepted herdr clipboard writes through OSC 52 even when a local
> native clipboard provider succeeds. On Crostini, `wl-copy`/`xclip` can update
> a container-local selection without updating the ChromeOS shared clipboard.
> The OSC 52 mirror lets supporting terminals bridge the same explicit user
> copy to their host clipboard while preserving the native path for all other
> terminals.
