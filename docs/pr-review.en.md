# Pull Request Review

Ordinary pull requests do not include release artifacts by default. Release
artifacts are generated from version tags by the `Release` workflow and uploaded
to GitHub Releases.

Use this document when a reviewer asks what to test when no downloadable PR
artifact is available.

## Source Checkout Review

Use this path when the reviewer can build on the target OS.

```sh
gh pr checkout <number> --repo oyoguhito/fpasoterm
npm install
npm run check
```

Without GitHub CLI:

```sh
git fetch origin pull/<number>/head:review-pr-<number>
git switch review-pr-<number>
npm install
npm run check
```

`git fetch` only downloads remote references; it does not change the current
working tree. Always run `git switch` or `git checkout` before building.

Prerequisites are Node.js 22+, Rust stable, and the native target tools: Xcode
Command Line Tools on macOS, or Visual Studio Build Tools with **Desktop
development with C++** plus the Edge WebView2 Runtime on Windows. If no local
checkout exists yet, clone first with
`git clone https://github.com/oyoguhito/fpasoterm.git` and `cd fpasoterm`.

## Windows MSI Review

Run these commands from PowerShell in the repository root. The PR-number ref
avoids guessing the head branch name:

```powershell
git fetch origin pull/<number>/head:review-pr-<number>
git switch review-pr-<number>
git status --short
git log -1 --oneline
npm ci
npm run check
npm run build:bundles
```

The empty `git status --short` and the final `git log` line confirm the exact
revision that is being packaged. `git fetch` alone leaves the current branch
unchanged and must not be used as the build step.

First test the built executable directly, which cannot accidentally launch an
older Start menu, pinned, or Path entry. Use the generated `.cmd` wrapper for
CLI output so PowerShell waits for the GUI-subsystem executable:

```powershell
.\src-tauri\target\release\fpasoterm.cmd --version
.\src-tauri\target\release\fpasoterm.exe
```

Then test the actual Node launcher behavior required by PRs that change CLI
startup. It must print a status line and return the PowerShell prompt without
waiting for the window:

```powershell
node .\bin\fpasoterm
Get-Content "$env:LOCALAPPDATA\fpasoterm\launcher.log" -Tail 40
```

The log should contain `cargo-build-start` / `cargo-build-complete` only when a
local build was required, followed by `desktop-spawned` and elapsed times.

Then open `Help` in the application and verify that `Config:` names the file
being edited, and that the expected PR UI is present.

An unreleased PR commonly has the same package version as an installed build.
Close every fpasoterm process before installing its MSI, then force Windows
Installer to reinstall the package rather than retaining its same-version
installation:

```powershell
Get-Process fpasoterm -ErrorAction SilentlyContinue | Stop-Process -Force
$msi = Get-ChildItem .\artifacts\*.msi | Sort-Object LastWriteTime -Descending | Select-Object -First 1
& msiexec.exe /i $msi.FullName REINSTALL=ALL REINSTALLMODE=vomus
if ($LASTEXITCODE -notin 0, 3010) { throw "MSI install failed: $LASTEXITCODE" }
```

Exit code `3010` means Windows requires a restart. Launch the installed app
from its updated Start menu shortcut after this step. When only functional
review is needed, prefer the direct release executable above; it is the most
reliable way to prove the PR branch is running.

## Windows Direct Binary Review

For changes that affect direct `fpasoterm.exe` behavior, build and run the
Windows binary from the PR branch.

Debug build:

```powershell
cargo build --manifest-path src-tauri/Cargo.toml
.\src-tauri\target\debug\fpasoterm.exe --help
.\src-tauri\target\debug\fpasoterm.exe --size 1200x800 --title "PR test" --titlebar-color "#2e7d32"
```

Release-style local build:

```powershell
npm run build
.\src-tauri\target\release\fpasoterm.exe --help
```

Expected behavior:

- `--help` exits before opening the GUI window and prints usage text.
- `--size` changes the initial window size.
- `--title` changes the custom titlebar text.
- `--titlebar-color` changes the custom titlebar color.

## macOS App Bundle Review

Run these commands in Terminal from the repository root. Build natively on the
architecture being reviewed: Apple Silicon builds arm64, while an Intel Mac
builds x64.

```sh
git fetch origin pull/<number>/head:review-pr-<number>
git switch review-pr-<number>
git status --short
git log -1 --oneline
npm ci
npm run check
npm run build:bundles
./src-tauri/target/release/fpasoterm --version
node ./bin/fpasoterm
tail -40 ~/.cache/fpasoterm/launcher.log
```

`node ./bin/fpasoterm` is the command to use when reviewing launcher behavior:
it must print a cached-runtime or Cargo-build status and return the Terminal
prompt before the window appears. Use `--foreground --console-diagnostics` only
to intentionally wait for compiler and application output.

Open the locally built app bundle separately to review the icon and Finder/App
bundle behavior:

```sh
open -n ./src-tauri/target/release/bundle/macos/fpasoterm.app
```

If macOS blocks an unsigned local build, use Finder's **Open** action and
approve it in Privacy & Security. Do not substitute an older tagged DMG for the
PR branch build.

## If There Is No Artifact

If there is no downloadable artifact on the PR, the review target is the PR
branch itself. The reviewer should check out the PR branch, install dependencies,
run the local checks, and build a local debug or release binary for the target
OS.

Do not use tag release assets as substitutes for PR artifacts, because those
assets were built from a version tag, not from the pull request branch.

## When PR Artifacts Are Required

If reviewers need downloadable `.exe`, `.msi`, `.deb`, `.rpm`, `.dmg`, or app
archives for every pull request, add a separate `pull_request` artifact workflow.
That workflow should build from the PR branch and upload GitHub Actions
artifacts, but it should not publish a GitHub Release.

Keep the tag-based `Release` workflow for official versioned releases.
