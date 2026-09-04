# SSHFS Mounts

FpasoTerm can mount a remote directory through the locally installed `sshfs` command. It does not implement an SSH server or copy files itself.

Open **Sync > SSHFS Mounts**, enter host, user, SSH port, absolute remote path, and a mount name. The manager opens as a modal in the active FpasoTerm window on every supported platform. On Linux and macOS, the local path is `User/mounts/<name>` below the active FpasoTerm configuration directory. On Windows, FpasoTerm assigns an available drive letter such as `Z:`. Use the resulting path from the terminal or another local application.

With an empty identity and password field, SSHFS uses normal SSH authentication, including `~/.ssh/config`, available default keys, and ssh-agent. An optional identity-file path is passed only to this SSHFS command. An optional password is supplied through standard input using `-o password_stdin`; it is cleared from the UI after the attempt and is never stored in config, logs, or sync files.

Install prerequisites before use: Linux usually provides `sshfs` through its package manager; macOS requires macFUSE and SSHFS; Windows requires SSHFS-Win and WinFsp. Password mode depends on the installed SSHFS implementation supporting `password_stdin`.

On macOS, FpasoTerm starts SSHFS in foreground mode so macFUSE keeps its mount channel when the application launches SSHFS without a Terminal. If an SSHFS error mentions `FD_CLOEXEC`, update the installed SSHFS package: this is a known macFUSE lazy-mount compatibility issue fixed upstream, not a credential or remote-path error.

On Windows, FpasoTerm uses SSHFS-Win's supported disk network-drive interface and assigns an unused drive letter. It does not invoke the bundled Cygwin `sshfs.exe` directly. SSHFS-Win displays the normal Windows credential dialog, owned by the active FpasoTerm window, using the same flow as Explorer and `net use`; use that dialog or Windows Credential Manager for authentication. The optional identity-file field is not accepted on Windows because SSHFS-Win mapped drives do not support that per-mount option; configure a supported SSHFS-Win key setup instead. The manager's initial status line still reports the exact SSHFS-Win installation path it found. Verify an installation in PowerShell:

For the remote root, enter `/`. FpasoTerm maps this to the SSHFS-Win root UNC form `\\sshfs.r\\user@host!port` without a trailing path separator. For a subdirectory, enter an absolute path such as `/home/user/project`.

```powershell
Test-Path "$env:ProgramFiles\SSHFS-Win\bin\sshfs.exe"
& "$env:ProgramFiles\SSHFS-Win\bin\sshfs.exe" --version
```

For a non-standard installation, set `FPASOTERM_SSHFS_PATH` to the full `sshfs.exe` path and restart FpasoTerm. SSHFS-Win documents its normal `bin` installation directory in its [official README](https://github.com/winfsp/sshfs-win).

FpasoTerm stores non-secret mount descriptions in `User/mounts/sshfs-mounts.json`, so reopening the manager can restore the fields and unmount a mount created earlier. On Windows it also stores the assigned drive letter. Passwords are not written there. Active managed mounts appear as `SSHFS (n)` in the terminal titlebar. Closing a terminal window asks for confirmation before leaving mounts active. Unmount through the same manager using the mount name. On Linux and macOS FpasoTerm only unmounts paths below its own `User/mounts` directory; on Windows it only unmounts the recorded drive letter.

The manager keeps a record when a mount attempt fails or when an external command already removed the filesystem. Such entries are marked `(not mounted)`. Select one and use **Forget Saved** to remove only the inactive record; FpasoTerm refuses this action while the filesystem is still mounted.

SSHFS-Win can occasionally leave a network drive mapped after a normal unmount. FpasoTerm first uses the normal Windows disconnect API and verifies the result. If the drive remains mapped, it shows a Windows confirmation dialog before ending `sshfs.exe` and retrying the disconnect. This forced recovery can disconnect other SSHFS-Win mounts available to the same Windows user; cancel it when another SSHFS-Win mount must remain active. A mount record is kept until the drive is verified as removed.
