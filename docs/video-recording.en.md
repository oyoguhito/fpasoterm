# Screen video recording

fpasoterm can record video from the built-in **Log** menu. This is separate
from readable terminal-output logging. When a fpasoterm plugin has a visible
frontmost canvas, **Video Start** records that canvas first. This includes the
remote desktop rendered by the RDP local-bridge plugin. When no plugin canvas
is visible and the platform WebView supports the operating-system picker,
fpasoterm can record a user-selected screen or window. On WebKitGTK/ChromeOS
builds without that picker, it instead records the fpasoterm terminal surface.

## Record a video

1. Open the titlebar hamburger menu, then **Log**.
2. Select **Video Start**.
3. If the RDP local bridge (or another reviewed canvas plugin) is visibly open,
   recording starts directly for its remote canvas; no system picker appears.
   Otherwise, if an operating-system capture picker opens, select the screen
   or window you want to record and approve sharing. If neither source is
   available, fpasoterm immediately starts its terminal-surface recording
   fallback.
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
the user's behalf. A visible plugin canvas is an exception to the picker: its
pixels already belong to the fpasoterm WebView, so it can be recorded without
capturing another application. The RDP route records the remote desktop canvas
only, not the fpasoterm titlebar, plugin controls, prompts, or an iframe.
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
produce a valid WebM through its normal WebView `MediaRecorder` path. Intel
macOS WKWebView can instead report MP4 support but encode an all-black
CanvasCapture movie. Only on Intel macOS, fpasoterm avoids that bad path and
sends verified plugin-or-terminal PNG frames to the built-in macOS AVFoundation
H.264/MP4 writer. It records the front plugin canvas when one is visible,
otherwise the terminal, and does not open a screen/window picker. If
AVFoundation cannot initialize, it falls back to the built-in animated GIF
writer. Windows retains the browser canvas MediaRecorder
fallback. PNG is an internal frame format, never the completed recording file.
**Video unavailable** is shown only when the applicable platform path cannot
create PNG canvas frames.

Some WebKitGTK builds produce a complete WebM document for each MediaRecorder
timeslice; concatenating those documents makes many players stop at the first
fragment. The Linux/ChromeOS terminal fallback does not concatenate those
payloads: it streams PNG snapshots directly into one native WebM muxer. The
Windows and Apple Silicon macOS terminal-surface MediaRecorder fallbacks buffer
one recording until **Video Stop** and write a single final payload. Intel
macOS writes bounded terminal PNG frames to AVFoundation's H.264 MP4 encoder;
only an AVFoundation setup failure falls back to GIF. Use moderate recording
durations on memory-constrained systems. OS-picker screen/window captures
continue to stream bounded chunks where that path is used.

On Intel macOS, the current built-in recording route captures the active plugin
canvas when one is present, otherwise the terminal; it needs no Screen
Recording permission. Use the system screen recorder when a full desktop or
another application's window is required. Apple Silicon macOS continues to
use normal WebView media capture and may request Screen Recording permission.
On Linux and ChromeOS, availability depends on the installed WebKitGTK/WebView
and portal setup. Windows WebView2 availability depends on the installed
runtime and its screen-capture support. Test the picker and plugin-canvas
route on each target platform before relying on recording in a workflow.

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
