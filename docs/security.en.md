# Security

FpasoTerm starts a user-selected shell and has the same authority as that user account. Treat terminal input, plugins, and synced command delivery as security-sensitive.

## Trust Boundaries

### Local plugins

Files enabled from `~/.config/fpasoterm/User/plugins/` run as JavaScript in the terminal renderer. They can read the exposed plugin API and act as the current user. Enable only reviewed local files. Do not enable a plugin merely because it has a familiar file name or came from an unreviewed repository.

### Sync-folder Broadcast

Remote Broadcast is disabled by default. `fpasoterm --setup-sync` generates a 32-character-or-longer `sync.commandSecret`. Configure the same secret only on devices and user accounts that you trust. FpasoTerm signs synced command files with HMAC-SHA-256 and ignores unsigned or invalidly signed files.

The secret is stored in each device's local `config.toml`; it is not placed in the shared folder. Do not commit it, put it in screenshots, paste it into an issue, or share the configuration file publicly. Rotate it by running `--setup-sync` again and updating every trusted device before using synced Broadcast again.

HMAC confirms that a command was created by a device holding the secret. It does not make a shared folder private, encrypt diagnostics or logs, or protect a device already compromised by malware. Keep the sync folder private and limit who can write to it.

### Broadcast confirmation

The Broadcast dialog asks for confirmation for a small set of destructive patterns such as `rm` and `git reset --hard`. This is an accidental-operation guard, not command authorization. CLI Broadcast, plugins, shell aliases, and commands that do not match the heuristic remain capable of executing commands. Review the command and targets before sending it.

## Reporting and Maintenance

Do not publish secrets, private log contents, sync paths, or command secrets in public issues. Use GitHub private vulnerability reporting when available, or contact the repository owner privately for a security issue.

CI runs a repository secret scan, `npm audit --omit=dev`, CodeQL for JavaScript and Rust, and `cargo audit` for Rust dependencies. These checks reduce known risk; they do not replace keeping FpasoTerm, its plugins, and the operating system updated.
