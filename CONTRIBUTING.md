# Contributing

Thank you for improving FpasoTerm.

## Development

Install Node.js 22+, Rust stable, and the native build prerequisites for the
target operating system before running the commands below.

- Linux: `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`,
  `libayatana-appindicator3-dev`, and `librsvg2-dev`.
- macOS: Xcode Command Line Tools (`xcode-select --install`).
- Windows: Visual Studio Build Tools with **Desktop development with C++** and
  the Microsoft Edge WebView2 Runtime.

```sh
npm ci
npm run check
node ./bin/fpasoterm --dev
```

On Windows PowerShell, use the same launcher command with backslashes:

```powershell
node .\bin\fpasoterm --dev
```

Normal launcher invocations return the prompt immediately and print whether a
cached runtime is used or Cargo is building one. Use
`--foreground --console-diagnostics` only when waiting for compiler and
desktop-process output is intentional.

## Pull Request Review

Do not review a tagged release asset when the requested change is in a pull
request. Check out the pull request revision, build it on the target OS, and
launch it through the Node launcher:

```sh
gh pr checkout <number> --repo oyoguhito/fpasoterm
npm ci
npm run check
node ./bin/fpasoterm
```

Detailed Windows MSI/direct-binary and macOS app-bundle procedures are in
[docs/pr-review.en.md](docs/pr-review.en.md). Japanese review instructions are
available in [docs/pr-review.ja.md](docs/pr-review.ja.md).

Before submitting changes, run:

```sh
npm run check
npm run scan:secrets
desktop-file-validate extra/linux/io.github.oyoguhito.fpasoterm.desktop
npm run build:artifacts
```

## Scope

- Keep terminal rendering delegated to xterm.js and shell integration delegated to the backend PTY.
- Keep IME switching delegated to the platform webview and the operating system.
- Keep public documentation in both English and Japanese when user-facing behavior changes.
