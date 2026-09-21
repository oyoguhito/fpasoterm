# Known Issues

## ChromeOS Linux Clipboard Divergence with herdr

The latest re-test confirms that the general fpasoterm clipboard bridge,
including fpasoterm↔another application, works. External application→herdr
also works: fpasoterm reads the OS clipboard and correctly sends its paste input
to the herdr pane. The remaining failing row is herdr copy mode→herdr paste: an
existing external-application value is pasted instead of the herdr value. On
Crostini, an `xclip` write—the same native X11 path used by herdr—can exit 0
without updating the ChromeOS/Chrome shared clipboard. This shows that
fpasoterm is not obstructing X11 writes; the missing bridge is from the native
clipboard to the shared clipboard. herdr copy mode→fpasoterm/another application
has not been re-tested in the current build.
See [Clipboard Flow and Test Matrix](clipboard.en.md) for the current verified
rows and the mandatory test procedure before changing clipboard code.

## ChromeOS/Baguette Window Position

ChromeOS/Baguette currently ignores or remaps desktop runtime window `x` / `y` placement for fpasoterm. During testing, the runtime reported that `set_position()` applied the requested position, but the visible window was still placed by the compositor/window manager.

Repeated delayed position reapplication and `moveTop()` were tested in earlier runtime experiments and removed because resizing the window could freeze the OS. A Tauri one-shot position restore was also tested and did not affect the visible position on the target environment. fpasoterm therefore restores window size only. Window position support is kept as a future task.

## ChromeOS/Baguette Transparent Terminal Background

Before the Tauri migration, xterm.js canvas alpha backgrounds did not compose as transparent on the tested ChromeOS/Baguette environment. Alpha backgrounds were rendered as black or opaque colors instead of showing the desktop behind the terminal.

The Tauri backend uses WebKitGTK on Linux, enables transparent windows, and sets xterm.js `allowTransparency = true` with a 65% opaque terminal background by default. ChromeOS/Baguette still needs device testing. If rendering flickers or turns black/white, launch with `--disable-dmabuf`, which sets `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

## Kitty/SIXEL Graphics

Rendering Kitty, SIXEL, or iTerm inline-image streams can leave the current Tauri/WebKitGTK WebView unresponsive, including to `Ctrl+C`. `[terminal.images]` is therefore disabled by default.

## macOS Gatekeeper

Release builds use ad-hoc code signing so CI can verify the generated `.app` bundle and `.dmg` structure. This prevents unsigned or structurally broken artifacts from being uploaded, but it is not the same as Apple Developer ID signing and notarization.

For normal double-click installation without Gatekeeper warnings, the release workflow still needs Developer ID certificate and notarization credentials. Until those credentials are configured, macOS may report that a downloaded app is damaged or cannot be verified even when the DMG passes CI validation.
