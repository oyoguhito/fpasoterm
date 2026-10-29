# Screen video recording

fpasoterm can record video from the built-in **Log** menu. This is separate
from readable terminal-output logging. On macOS, every **Video Start** first
requests a user-selected fpasoterm window so one recording can follow changes
between the terminal and plugins while including the remote desktop, controls,
and native popups. Other platforms retain their existing canvas-first path.
When no plugin canvas is visible and the platform WebView supports the
operating-system picker, fpasoterm can record a user-selected screen or window.
On WebKitGTK/ChromeOS builds without that picker, it instead records the
fpasoterm terminal surface.

## Record a video

1. Open the titlebar hamburger menu, then **Log**.
2. Select **Video Start**.
3. On macOS, select the **fpasoterm window** and approve sharing, even when
   starting from the terminal. The same recording then follows later changes to
   an RDP local-bridge or another reviewed plugin and includes controls and
   popups. If the picker API is unavailable, fpasoterm uses a native snapshot
   of its own window, which keeps the same terminal-to-plugin behavior without
   selecting another application. Only if that native capture is unavailable
   does it fall back to the currently visible plugin canvas or terminal. On
   other platforms, a visible plugin canvas starts recording directly.
   Otherwise, select the intended screen or window in an available
   operating-system picker. If neither source is available, fpasoterm
   immediately starts its terminal-surface recording fallback.
4. The titlebar changes to **Recording** and the menu action changes to
   **Video Stop**. Continue using fpasoterm normally.
5. Choose **Log → Video Stop**. The titlebar shows **Saving video** while the
   final chunks are written.
6. Choose **Log → Video Show**. Its selector lists completed recordings, like
   **Log Show** lists text logs. Select one and choose **Open Selected** to
   open it in the operating system's default associated application. Choose
   **Delete Selected** and confirm to permanently remove that recording, or
   choose **Delete All** and confirm to remove every completed video recording.

The completed file is a video-only WebM (preferred), MP4, or animated GIF named
`video-<title>-<pid>-<timestamp>.webm`, `.mp4`, or `.gif` in `logging.directory`, or in
`~/.config/fpasoterm/User/logs` when that setting is empty. The Diagnostics
log records the final path and byte count. Existing text log actions only
operate on `terminal-*.log`; **Log Show** and **Delete All** do not inspect or
remove video files. **Video Show** is separate from **Log Show** because GIF,
WebM, and MP4 files are selected in the shared panel but opened by an OS
viewer rather than decoded into the text diagnostics area. Its **Delete
Selected** action is limited to a selected `video-*.(gif|webm|mp4)` file in
the configured logging directory and always requires confirmation. **Delete
All** has the same directory/file-name restriction, always requires
confirmation, and never removes `terminal-*.log` text logs.

The built-in GIF fallback writes the standard infinite-repeat extension. A
viewer that plays it once is ignoring that extension; use a GIF-capable image
viewer or browser when continuous playback is required.

The OS picker is intentional where it is available. A recording can start only
from the explicit **Video Start** action; fpasoterm does not start one from
terminal output, plugin code, or a timer, and it does not choose a display on
the user's behalf. A visible plugin canvas is an exception to the picker on
non-macOS platforms: its pixels already belong to the fpasoterm WebView, so it
can be recorded without capturing another application. On macOS, fpasoterm
deliberately asks the user to select its own window for every recording, so one
window stream remains valid when the foreground later changes from terminal to
plugin. A canvas snapshot cannot include surrounding controls or native popups.
When WKWebView omits the picker API, fpasoterm captures only its own NSWindow
natively before resorting to a canvas fallback. If both paths are unavailable,
the RDP fallback records the remote desktop canvas only, not the fpasoterm
titlebar, plugin controls, prompts, or an iframe.
Select only a screen/window surface you are allowed to record; a full-screen
choice can include other applications and sensitive data. The terminal-surface
fallback captures no other application and needs no picker.

## Limits and platform support

When the platform WebView supplies a `MediaRecorder`, fpasoterm chooses WebM
first and MP4 only when WebM is unavailable. The preferred screen/window path
also uses `navigator.mediaDevices.getDisplayMedia`. On Linux and ChromeOS, a
front plugin canvas uses the native PNG-to-WebM route immediately; without a
plugin canvas, the same route is used if the picker is absent or fails because
no portal/device is available. fpasoterm captures visible-plugin or
terminal-canvas PNG frames and encodes them in-process with the GStreamer
runtime already used by WebKitGTK: `appsrc → VP8 → WebM` at 5 fps. This avoids
the known WebKitGTK
`CanvasCaptureMediaStream` failure in which a syntactically valid WebM contains
only stale canvas paints. It needs
no `gst-launch`, ffmpeg, Chromium, or separate recorder installation. A
minimal Linux image without the GStreamer appsrc/VP8/WebM plugins falls back to
the built-in animated GIF writer. Apple Silicon macOS has been observed to
produce a valid WebM through its normal WebView `MediaRecorder` path. On both
macOS architectures, every start first uses a user-approved fpasoterm
window/display stream when the picker is available, so terminal-to-plugin
changes remain in the complete recording.
Intel macOS WKWebView can instead report MP4 support but encode an all-black
CanvasCapture movie. When the picker is unavailable, macOS first creates PNG
snapshots of fpasoterm's own NSWindow. Apple Silicon copies those trusted PNGs
into its established WebM-capable MediaRecorder canvas path; Intel sends them
to the built-in macOS AVFoundation H.264/MP4 writer. Only if native window
capture fails does it use verified plugin-or-terminal canvas PNG frames;
AVFoundation initialization failure falls back to the built-in animated GIF
writer. Windows retains the browser canvas MediaRecorder fallback. PNG is an
internal frame format, never the completed recording file.
**Video unavailable** is shown only when the applicable platform path cannot
create PNG canvas frames.

Some WebKitGTK builds produce a complete WebM document for each MediaRecorder
timeslice; concatenating those documents makes many players stop at the first
fragment. The Linux/ChromeOS terminal fallback does not concatenate those
payloads: it streams PNG snapshots directly into one native WebM muxer. The
Windows and Apple Silicon macOS MediaRecorder paths buffer one recording until
**Video Stop** and write a single final payload. On Apple Silicon, that includes
the native self-window PNG-to-canvas route used when the picker API is missing.
Intel macOS writes bounded self-window, plugin, or terminal PNG frames to
AVFoundation's H.264 MP4 encoder; only an AVFoundation setup failure falls back
to GIF. Use moderate recording durations on memory-constrained systems.
OS-picker screen/window captures continue to stream bounded chunks where that
path is used.

On macOS, choosing the fpasoterm window can require Screen Recording permission
and is the supported way to include plugin controls and native popups. When the
picker API is absent, fpasoterm first tries that same self-window image and
then rasterizes its own AppKit content view if macOS denies CoreGraphics screen
capture. The latter neither observes another application nor requires selecting
a display; it prioritizes the terminal and plugin surface. Linux/ChromeOS and
Windows retain their existing behavior. Test the picker and plugin-canvas route
on each target platform before relying on recording in a workflow.

Audio, microphone capture, automatic capture, editing, streaming, and a
video-library UI are out of scope for this first version. GIF fallback files
are deliberately low-rate terminal recordings rather than full desktop video.
If fpasoterm exits or the WebView crashes before Video Stop, the recorded
prefix may be present but the video file might not be finalized; stop
recordings from the menu whenever possible.

## Storage cap

`[logging].videoMaxBytes` limits one video recording and defaults to
2 GiB. It is independent of `[logging].maxBytes`, which only limits readable
terminal text logs. Increase it only when the destination has sufficient free
space:

```toml
[logging]
videoMaxBytes = 4294967296 # 4 GiB
```

When the cap is reached, fpasoterm stops accepting new video chunks and saves
the valid prefix written so far. Use **Video Stop** to finalize that file.
