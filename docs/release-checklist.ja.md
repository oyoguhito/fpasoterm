# リリースチェックリスト

## ローカル確認

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

release PR を merge した後、version tag を作成して push します。

```sh
git tag v1.0.0
git push origin v1.0.0
```

`Release` workflow は tag version と `package.json` の version が一致することを確認し、`artifacts/` を生成して GitHub Release に添付します。

## ChromeOS Linux 手動確認

```sh
./scripts/run
fpasoterm
FPASOTERM_DEBUG_KEYS=1 ./scripts/run
```

確認項目:

- Wayland/GPU エラーで起動に失敗しない。
- Terminal shell が表示され、通常の ASCII 入力を受け付ける。
- 設定済みの ChromeOS Linux 入力メソッドで日本語入力できる。
- `かな` / `英数` キーを fpasoterm が横取りしない。
- debug 時に `diagnostics/fpasoterm-debug.log` が書き出される。
- package 公開後、`npm install -g fpasoterm` で `fpasoterm` コマンドが使える。
- artifact に `fpasoterm-<version>.tgz` と `fpasoterm-<version>-source-portable.tar.gz` が含まれる。
- GitHub Actions の `Check` と `Security` workflow が通る。
- secret scan で credential 候補が検出されない。
- production dependency audit で既知の脆弱性が検出されない。

## ドキュメント確認

- README に基本的な英語の利用手順がある。
- `docs/spec.en.md` に構成と入力方針が英語で書かれている。
- `docs/spec.ja.md` に同じ方針が日本語で書かれている。
- リリースノートには検証済みの ChromeOS Linux 条件を明記する。
- icon asset が `extra/logo/fpasoterm.png` に存在する。
- `LICENSE` が存在し、package metadata が `MIT` になっている。
