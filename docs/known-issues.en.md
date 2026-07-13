# Known Issues

## ChromeOS/Baguette Window Position

ChromeOS/Baguette currently ignores or remaps desktop runtime window `x` / `y` placement for fpasoterm. During testing, the runtime reported that `setBounds()` applied the requested position, but the visible window was still centered by the compositor/window manager.

Repeated delayed position reapplication and `moveTop()` were tested and then removed because resizing the window could freeze the OS. fpasoterm therefore restores window size only. Window position CLI flags are intentionally not exposed.

## ChromeOS/Baguette Transparent Terminal Background

xterm.js canvas alpha backgrounds do not compose as transparent on the tested ChromeOS/Baguette environment. Alpha backgrounds were rendered as black or opaque colors instead of showing the desktop behind the terminal.

Terminator can provide a transparent terminal on the same environment, which suggests that GTK/VTE can use a compositor path that xterm.js canvas does not. Future transparent terminal support should be considered as a Linux-specific GTK/VTE frontend rather than more xterm.js alpha tuning.
