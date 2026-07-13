# Known Issues

## ChromeOS/Baguette Window Position

ChromeOS/Baguette currently ignores or remaps desktop runtime window `x` / `y` placement for fpasoterm. During testing, the runtime reported that `set_position()` applied the requested position, but the visible window was still placed by the compositor/window manager.

Repeated delayed position reapplication and `moveTop()` were tested in earlier runtime experiments and removed because resizing the window could freeze the OS. A Tauri one-shot position restore was also tested and did not affect the visible position on the target environment. fpasoterm therefore restores window size only. Window position support is kept as a future task.

## ChromeOS/Baguette Transparent Terminal Background

Before the Tauri migration, xterm.js canvas alpha backgrounds did not compose as transparent on the tested ChromeOS/Baguette environment. Alpha backgrounds were rendered as black or opaque colors instead of showing the desktop behind the terminal.

The Tauri backend uses WebKitGTK on Linux, enables transparent windows, and sets xterm.js `allowTransparency = true` with an 80% opaque terminal background by default. ChromeOS/Baguette still needs device testing. If rendering flickers or turns black/white, launch with `--disable-dmabuf`, which sets `WEBKIT_DISABLE_DMABUF_RENDERER=1`.
