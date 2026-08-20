# Sync Folder

fpasoterm can share diagnostics and terminal output logs through a local folder that is synchronized by another tool, such as Google Drive for desktop, OneDrive, Dropbox, Syncthing, or rsync.

fpasoterm does not call the Google Drive API. It does not require OAuth, API keys, or a Google Cloud project. Google Drive is only responsible for syncing files that fpasoterm writes to a local folder.

## Configuration

For first-time setup, use the interactive setup command:

```sh
fpasoterm --setup-sync
```

When running from a source checkout on Windows, `bin/fpasoterm` is a Node.js script, so run it through `node`.

PowerShell:

```powershell
node .\bin\fpasoterm --setup-sync
```

cmd.exe:

```bat
node bin\fpasoterm --setup-sync
```

After a global npm install, the normal command works on Windows too:

```powershell
fpasoterm --setup-sync
```

It asks for the local sync folder, channel, and a generated command secret, then creates or updates `[sync]` and `[logging]` in `~/.config/fpasoterm/User/config.toml`. Copy the same secret only to trusted devices that need remote Broadcast. Existing window, terminal, and plugin settings are preserved.

On ChromeOS, if folders such as `shared` and `temp` are shared with Linux, `--setup-sync` lists writable candidates. Enter a candidate number or type the exact path.

### Sync Channel

`Sync channel` is a name that separates sync data inside the same sync folder. In normal use, keep `default`.

Only fpasoterm instances with the same `path` and the same `channel` share diagnostics and logs in the same location. If ChromeOS and Windows should share the same sync area, use the same channel name on both machines.

### Status, Health, and Cleanup

Use these commands before troubleshooting a sync folder or after a device was offline for a long time:

```bash
fpasoterm --sync-status
fpasoterm --sync-diagnostics
fpasoterm --sync-clean
```

`--sync-status` is read-only. It reports the resolved local path, current channel, root existence/read/write checks, diagnostics file size, short-lived command counts, and every discovered channel below the sync root. `--sync-diagnostics` prints the same Markdown report so it can be pasted into a GitHub Issue.

`--sync-clean` scans every channel in the configured sync root. It removes only command JSON files whose expiry has passed, plus malformed or temporary command files older than `commandTtlSeconds`. It never removes `diagnostics.json`, terminal logs, or valid pending commands. A disabled or missing sync folder is not created by status or cleanup.

The hamburger menu also provides **Sync Status** and **Sync Clean**. Sync Status opens the same health information in the diagnostics panel. Sync Clean performs the same safe stale-file cleanup, then refreshes that panel.

Examples:

```text
default
```

General use. This is enough when all machines share one sync destination.

```text
work
```

Use this when you want work sync data separated.

```text
chromeos-test
```

Use this for testing without mixing data into your normal sync channel.

## Preparing a Google Drive Folder

fpasoterm does not mount Google Drive itself. First, make Google Drive available as a local folder through your OS.

### ChromeOS / Baguette

1. Open the ChromeOS Files app.
2. Create folders under `Google Drive` -> `My Drive` that will be shared with Linux. Examples: `shared`, `temp`.
3. Right-click each folder and choose `Share with Linux`.
4. Confirm that Linux can see the folder:

```sh
ls /mnt/chromeos/shared/GoogleDrive/MyDrive/shared
```

5. Use a sync path such as:

```text
/mnt/chromeos/shared/GoogleDrive/MyDrive/shared/fpasoterm-sync
```

Baguette can expose the MyDrive root while still refusing writes directly under that root from Linux. In that case, use a folder that was individually shared with Linux from the ChromeOS Files app. In the example above, that is the `shared` folder.

Other ChromeOS Linux environments may expose the same shared folder as `/mnt/shared/GoogleDrive/MyDrive/shared` or `/mnt/chromeos/GoogleDrive/MyDrive/shared`. Use a path that exists and is writable from Linux.

If a shared folder is renamed in the ChromeOS Files app, Linux sharing may not follow the new name automatically. For example, after renaming `test` to `temp`, right-click the renamed `temp` folder and choose `Share with Linux` again.

If you shared a `temp` folder, the path follows the same pattern:

```text
/mnt/chromeos/shared/GoogleDrive/MyDrive/temp/fpasoterm-sync
```

If neither path exists, open ChromeOS Settings, then `Developers` -> `Linux development environment` -> `Manage shared folders`, and confirm that Google Drive is shared with Linux.

### macOS

1. Install Google Drive for desktop and sign in.
2. Find the local Google Drive folder in Finder.
3. A common path looks like:

```text
~/Library/CloudStorage/GoogleDrive-<account>/My Drive/fpasoterm-sync
```

The `<account>` part differs by machine. Drag the folder from Finder into Terminal if you need the exact path.

### Windows

1. Install Google Drive for desktop and sign in.
2. Find the Google Drive drive letter or local folder in Explorer.
3. Create a `fpasoterm-sync` folder inside Google Drive.
4. A common path looks like:

```text
G:\My Drive\fpasoterm-sync
```

If your drive letter is not `G:`, use the actual path shown on that machine. Depending on localization or Google Drive settings, it may look like `G:\マイドライブ\fpasoterm-sync` or `D:\My Drive\fpasoterm-sync`.

PowerShell examples for checking the path:

```powershell
Test-Path 'G:\My Drive'
Test-Path 'G:\マイドライブ'
```

If `--setup-sync` does not show candidates, type the exact Google Drive folder path shown in Explorer.

### Linux desktop

Google does not provide an official Google Drive desktop client for Linux. Use a local synced folder from rclone mount, google-drive-ocamlfuse, Insync, Syncthing, Dropbox, rsync, or another sync tool that fpasoterm can read and write as a normal directory.

## Manual Configuration

Add a `[sync]` section to `~/.config/fpasoterm/User/config.toml`:

```toml
[sync]
enabled = true
provider = "folder"
path = "~/Google Drive/fpasoterm-sync"
channel = "work"
diagnostics = true
maxBytes = 1048576
commands = true
commandSecret = "paste-the-same-32-character-or-longer-secret-on-trusted-devices"
commandTtlSeconds = 60
```

Use the same `path` and `channel` on the other fpasoterm instance. If your Google Drive folder uses another name, set `path` to that exact local directory.

On ChromeOS/Baguette, use:

```toml
path = "/mnt/chromeos/shared/GoogleDrive/MyDrive/shared/fpasoterm-sync"
```

If another ChromeOS Linux environment exposes the folder under a different path, use the path that exists:

```toml
path = "/mnt/shared/GoogleDrive/MyDrive/shared/fpasoterm-sync"
path = "/mnt/chromeos/GoogleDrive/MyDrive/shared/fpasoterm-sync"
```

## Files

For `channel = "work"`, fpasoterm writes:

```text
<sync path>/work/diagnostics.json
<sync path>/work/commands/command-<source>-<timestamp>.json
```

`diagnostics.json` contains a JSON payload with `kind`, `channel`, `sourceId`, `updatedAt`, and `text`.

`commands` contains short-lived broadcast-input requests only when a user explicitly selects `Include synced channel` in the Broadcast dialog. It is disabled by default. Enable it only with a `commandSecret` of at least 32 characters shared by trusted devices. FpasoTerm signs command files with HMAC-SHA-256 and ignores unsigned or invalid files. `commandTtlSeconds` defaults to 60 and is capped at 600 seconds. Set `commands = false` to keep diagnostics/log sync while refusing remote input commands.

## Usage

When sync is enabled, fpasoterm automatically writes a debounced diagnostics snapshot to `diagnostics.json` as diagnostics change. The snapshot contains the current in-memory diagnostics ring buffer, which is the most recent fpasoterm diagnostics/debug log lines from this app session. It is for troubleshooting fpasoterm itself, such as config loading, PTY events, renderer errors, and sync folder activity. It is not the terminal output log.

To stop writing `diagnostics.json`, disable sync in `config.toml`:

```toml
[sync]
enabled = false
```

Clearing `sync.path` also disables sync because there is no destination folder. After editing `config.toml`, restart fpasoterm or apply the config from the running terminal.

In short, `sync.enabled = false` is the setting for a local-only session with no sync-folder diagnostics writes.

## Broadcast Input

`Ctrl+Shift+B` opens the Broadcast dialog. Select the target local windows by title and PID, then use `Send` to deliver the entered command only to those windows. With every local window selected, `Include synced channel` additionally writes a temporary request under `<sync path>/<channel>/commands`. Every already-running fpasoterm using that same folder and channel receives it once and writes it to its own PTY. Partial local selection never sends to the sync channel.

The same operation is available without opening a window:

```sh
# Send to every currently running local fpasoterm window.
fpasoterm --broadcast "git status"

# Select one or more local targets by PID or exact title.
fpasoterm --broadcast "uptime" --broadcast-target 1234,"Build-2"

# Send to all local windows and to the configured trusted sync channel.
fpasoterm --broadcast "hostname" --broadcast-sync
```

`--broadcast` normalizes line endings and appends Enter. `--broadcast-target` can be repeated or comma-separated; an unmatched selector is an error. If no target is specified, all currently running local windows are selected. `--broadcast-sync` requires all local windows to be selected, and requires `[sync] enabled = true`, `commands = true`, and a 32-character-or-longer `commandSecret`. It does not start fpasoterm on another machine: only already-running instances sharing the same trusted folder, channel, and secret can receive the command.

This is intentionally a trusted-folder feature. Command JSON requires an HMAC-SHA-256 signature, but any device holding the secret can type a command into participating terminals. It provides no encryption, remote launch, or delayed execution. Do not enable synced commands for a shared or untrusted folder.

## Terminal Output Logs

Sync folder diagnostics are separate from terminal output logging. The hamburger menu contains `Log Start (^S)` / `Log Stop (^S)` and `Log Show (^P)`. `Ctrl+Shift+L` opens that menu at the log actions; `Ctrl+Shift+S` records terminal output to a local log file or closes that file, and `Ctrl+Shift+P` opens a selector for captured logs. The log panel can delete the selected stopped log, or `Delete All` can empty the active log and delete all stopped `terminal-*.log` files after an in-panel confirmation. Saved log files are normalized for readability by removing common ANSI/control sequences, OSC sequences, and CR/control characters or replacing them with line breaks. By default logs are written under `~/.config/fpasoterm/User/logs`.

In `Log Show`, use the search field and `Search` button to select and scroll to the next matching text in the displayed log. Repeating `Search` or pressing `N` advances through every match and wraps back to the first match; pressing `P` moves to the previous match. When the log text area has focus, `j` moves to the next match and `k` moves to the previous match. Arrow keys remain available for normal text area scrolling. The counter shows the current match number. Select displayed log text and press `Ctrl+Shift+C` to copy that selection through the same clipboard path used by terminal selection copy.

When running tmux, screen, byobu, or herdr, fpasoterm receives the already-rendered PTY output stream. It cannot reliably know which multiplexer pane produced each byte, so pane-specific logging should be done with the multiplexer itself, such as `tmux capture-pane` or a pane-level logging feature.

When `--setup-sync` asks `Store terminal output logs in the sync folder?`, choose `N` or press Enter if you do not want terminal output logs in the sync folder. This is the normal choice.

If you choose `y`, the following `Terminal log directory` default is under the selected sync folder. On Windows it may look like `G:\マイドライブ\fpasoterm-sync\logs`. That is still a local Windows path, but Google Drive for desktop synchronizes it to other machines.

Paths can use `~`, `%USERPROFILE%`, `$HOME`, and similar environment variables. When sharing config across ChromeOS, macOS, and Windows, `~` or explicit per-OS paths are usually easier to reason about.

Only put logs in a synced folder when you explicitly want that:

```toml
[logging]
enabled = true
directory = "~/Google Drive/fpasoterm-sync/logs"
autoStart = false
maxBytes = 10485760
```

The same feature can be controlled from inside the terminal:

```sh
printf '\033]777;log=start\a\r\n'
printf '\033]777;log=stop\a\r\n'
printf '\033]777;log=start;logPath=session.log\a\r\n'
```

In PowerShell:

```powershell
[Console]::Write("$([char]27)]777;log=start$([char]7)`r`n")
[Console]::Write("$([char]27)]777;log=stop$([char]7)`r`n")
```

## Security

Only diagnostics are synchronized automatically by the sync-folder diagnostics feature. fpasoterm does not synchronize full terminal output automatically.

Terminal logs may contain command output, prompts, and other sensitive data. If `logging.directory` points to a synced folder, protect that folder appropriately.

The first implementation stores plain JSON and plain terminal logs. Do not use this for secrets unless the sync folder is protected appropriately. A later version can add encrypted payloads if needed.
