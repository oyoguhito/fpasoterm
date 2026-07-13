# Contributing

Thank you for improving FpasoTerm.

## Development

```sh
npm install
npm run check
./scripts/run
```

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
