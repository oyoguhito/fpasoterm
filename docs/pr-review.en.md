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
