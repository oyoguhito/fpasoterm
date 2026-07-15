# Release Checklist

## Local Checks

```sh
npm ci
npm run check
npm run scan:secrets
desktop-file-validate extra/linux/io.github.oyoguhito.fpasoterm.desktop
npm run audit:prod
npm pack --dry-run
npm run build:artifacts
```

## GitHub Release

Create and push a version tag after the release PR is merged:

```sh
git tag v1.0.1
git push origin v1.0.1
```

The `Release` workflow validates that the tag version matches `package.json`, builds `artifacts/`, and attaches the generated files to the GitHub Release.

To rebuild assets for an existing tag, run the `Release` workflow manually and pass the tag name. The workflow uploads release assets with clobber enabled.

Release assets are built on GitHub-hosted runners for:

- source package and portable source archive
- Linux x64 packages
- Linux arm64 packages for ChromeOS/Baguette and other arm64 Linux systems
- macOS x64 bundle
- macOS arm64 bundle
- Windows x64 bundle

## ChromeOS Linux Manual Checks

```sh
./scripts/run
fpasoterm
FPASOTERM_DEBUG_KEYS=1 ./scripts/run
```

Verify:

- The app starts without Wayland/GPU errors.
- The terminal shell appears and accepts normal ASCII input.
- Japanese input works with the configured ChromeOS Linux input method.
- `かな` / `英数` keys are not intercepted by fpasoterm.
- If debugging, `diagnostics/fpasoterm-debug.log` is written.
- `npm install -g fpasoterm` exposes the `fpasoterm` command after the package is published.
- Artifacts include `fpasoterm-<version>.tgz` and `fpasoterm-<version>-source-portable.tar.gz`.
- GitHub Release assets include Linux x64, Linux arm64, macOS x64, macOS arm64, and Windows x64 bundles.
- GitHub Actions `Check` and `Security` workflows pass.
- Secret scanning reports no potential credentials.
- Production dependency audit reports no known vulnerabilities.

## Documentation Checks

- README has basic English usage.
- `docs/spec.en.md` explains architecture and input policy.
- `docs/spec.ja.md` explains the same policy in Japanese.
- Release notes should mention the tested ChromeOS Linux condition.
- The icon asset exists at `extra/logo/fpasoterm.png`.
- `LICENSE` exists and package metadata says `MIT`.
