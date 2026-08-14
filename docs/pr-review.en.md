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
git fetch origin <branch-name>
git switch -c review-<number> origin/<branch-name>
npm install
npm run check
```

`git fetch` only downloads remote references; it does not change the current
working tree. Always run `git switch` or `git checkout` before building.

## Windows MSI Review

For PR #41, use `release-v1.5.0` as the branch name below. Replace it with the
PR head branch for later reviews. Run these commands from PowerShell in the
repository root:

```powershell
git fetch origin release-v1.5.0
git switch --detach origin/release-v1.5.0
git status --short
git log -1 --oneline
npm ci
npm run check
npm run build:artifacts -- --bundles-only
```

The empty `git status --short` and the final `git log` line confirm the exact
revision that is being packaged. `git fetch` alone leaves the current branch
unchanged and must not be used as the build step.

First test the built executable directly, which cannot accidentally launch an
older Start menu, pinned, or Path entry:

```powershell
.\src-tauri\target\release\fpasoterm.exe --version
.\src-tauri\target\release\fpasoterm.exe
```

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
