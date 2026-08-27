# Command Completion

fpasoterm can print completion scripts for Bash, Zsh, Fish, and PowerShell.
The scripts complete CLI options and the values for `--completion`; Bash and
Zsh also query local profile and plugin lists for those options.

```sh
fpasoterm --completion bash
fpasoterm --completion zsh
fpasoterm --completion fish
fpasoterm --completion powershell
```

The command only writes a script to standard output. It does not start a
terminal window or modify configuration. To install or remove fpasoterm's
user-only persistent completion file, use:

```sh
fpasoterm --completion-install bash
fpasoterm --completion-uninstall bash
```

Replace `bash` with `zsh`, `fish`, or `powershell`. Install and uninstall only
touch fpasoterm-owned user files; they do not modify system completion files.

## Updating Completion

An application update does not require reinstallation for the existing
completion script to keep working. Persistent completion is a copied user file,
so rerun the install command only when you want newly added CLI options or
value candidates to appear in Tab completion:

```sh
fpasoterm --completion-install bash
fpasoterm --completion-install zsh
fpasoterm --completion-install fish
fpasoterm --completion-install powershell
```

Restart the shell after updating. In PowerShell, `. $PROFILE` reloads the
profile without opening a new console. Use `--completion-uninstall <shell>`
only to remove completion; it is not needed for a normal update.

## Bash

Current shell:

```bash
source <(fpasoterm --completion bash)
```

Persistent user installation: `fpasoterm --completion-install bash`.
It installs `~/.local/share/bash-completion/completions/fpasoterm` (or the
equivalent location under `XDG_DATA_HOME`). Remove it with
`fpasoterm --completion-uninstall bash`.

## Zsh

Current shell:

```zsh
source <(fpasoterm --completion zsh)
```

Persistent user installation: `fpasoterm --completion-install zsh`.
It installs `~/.zfunc/_fpasoterm`; remove it with
`fpasoterm --completion-uninstall zsh`.

Add `fpath=(~/.zfunc $fpath)` before `autoload -Uz compinit && compinit` in
`.zshrc` when `~/.zfunc` is not already in `fpath`.

## Fish

Current shell:

```fish
fpasoterm --completion fish | source
```

Persistent user installation: `fpasoterm --completion-install fish`.
It installs `~/.config/fish/completions/fpasoterm.fish` (or the equivalent
location under `XDG_CONFIG_HOME`); remove it with
`fpasoterm --completion-uninstall fish`.

Fish automatically loads that file in later shells.

## PowerShell

Current PowerShell session:

```powershell
fpasoterm --completion powershell | Out-String | Invoke-Expression
```

For a persistent user installation, use:

```powershell
fpasoterm --completion-install powershell
```

This writes a fpasoterm-owned script below `User/completions` and adds one
marked fpasoterm block to every available user PowerShell profile (`pwsh` and
Windows PowerShell). It handles redirected Documents folders. Remove both the
script and only those marked blocks with `fpasoterm --completion-uninstall powershell`.
If a profile contains only that managed block, uninstall removes the otherwise
empty profile file too; unrelated profile settings are preserved.

The fpasoterm window does not reload a PowerShell profile. Close and reopen the
PowerShell console after installing, or enable it immediately in the current
console with:

```powershell
. $PROFILE
```

Profiles are skipped when PowerShell is launched with `-NoProfile`; in that
case source the installed completion script manually or start PowerShell
without `-NoProfile`.

If PowerShell reports that scripts cannot run, inspect the effective policy and
allow locally-created scripts for the current user only. This does not require
an administrator console:

```powershell
Get-ExecutionPolicy -List
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
. $PROFILE
```

An organization policy can override `CurrentUser`; in that case contact the
device administrator rather than using a machine-wide bypass.

When using an installer artifact directly, use the console wrapper so output
returns to PowerShell:

```powershell
.\fpasoterm.cmd --completion powershell | Out-String | Invoke-Expression
```

`cmd.exe` does not provide a comparable programmable argument-completion API.
Use PowerShell for Windows interactive completion.
