# Release Checklist

## Local Checks

```sh
npm ci
npm run check
npm run scan:secrets
desktop-file-validate extra/linux/io.github.oyoguhito.FpasoTerm.desktop
npm run audit:prod
npm pack --dry-run
npm run build:artifacts
```

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
- `かな` / `英数` keys are not intercepted by FpasoTerm.
- If debugging, `diagnostics/fpasoterm-debug.log` is written.
- `npm install -g fpasoterm` exposes the `fpasoterm` command after the package is published.
- Artifacts include `fpasoterm-<version>.tgz` and `fpasoterm-<version>-source-portable.tar.gz`.
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
