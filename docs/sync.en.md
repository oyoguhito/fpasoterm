# Sync Folder

fpasoterm can share explicit clipboard text and diagnostics through a local folder that is synchronized by another tool, such as Google Drive for desktop, OneDrive, Dropbox, Syncthing, or rsync.

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

It asks for the local sync folder and channel, then creates or updates `[sync]` and `[logging]` in `~/.config/fpasoterm/User/config.toml`. Existing window, terminal, and plugin settings are preserved.

On ChromeOS, if folders such as `shared` and `temp` are shared with Linux, `--setup-sync` lists writable candidates. Enter a candidate number or type the exact path.

### Sync Channel

`Sync channel` is a name that separates sync data inside the same sync folder. In normal use, keep `default`.

Only fpasoterm instances with the same `path` and the same `channel` share clipboard text, diagnostics, and logs in the same location. If ChromeOS and Windows should share the same clipboard sync, use the same channel name on both machines.

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
clipboard = true
diagnostics = true
pasteRequiresConfirm = true
maxBytes = 1048576
ttlSeconds = 86400
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
<sync path>/work/clipboard.json
<sync path>/work/diagnostics.json
```

These files contain JSON payloads with `kind`, `channel`, `sourceId`, `updatedAt`, and `text`.

## Usage

When sync is enabled, the titlebar shows:

The titlebar `Sync` menu provides:

- `Copy Selection`: writes the selected terminal text to `clipboard.json`. If no text is selected, it writes the current local clipboard text.
- `Pull to Clipboard`: reads `clipboard.json` and copies the text to the local OS clipboard. It does not paste directly into the terminal.
- `Write Diagnostics`: writes recent fpasoterm diagnostics/debug logs to `diagnostics.json`. This is not the terminal output log.

`Pull to Clipboard` does not paste directly into the terminal. It copies text to the local OS clipboard first, so you can review it and paste intentionally.

## Terminal Output Logs

Sync folder diagnostics are separate from terminal output logging. The titlebar `Log Start` button records raw terminal output to a local log file, and `Log Stop` closes that file. By default logs are written under `~/.config/fpasoterm/User/logs`.

When `--setup-sync` asks `Store terminal output logs in the sync folder?`, choose `N` or press Enter if you do not want terminal output logs in the sync folder. This is the normal choice.

If you choose `y`, the following `Synced terminal log directory` default is under the selected sync folder. On Windows it may look like `G:\マイドライブ\fpasoterm-sync\logs`. That is still a local Windows path, but Google Drive for desktop synchronizes it to other machines.

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

Only explicitly copied text and diagnostics are synchronized. fpasoterm does not synchronize full terminal output automatically.

Terminal logs may contain command output, prompts, and other sensitive data. If `logging.directory` points to a synced folder, protect that folder appropriately.

The first implementation stores plain JSON and plain terminal logs. Do not use this for secrets unless the sync folder is protected appropriately. A later version can add encrypted payloads if needed.
