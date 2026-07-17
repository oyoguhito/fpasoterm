# Pull Request Review

通常の pull request には、release artifact を標準では添付しません。Release
artifact は version tag から `Release` workflow で生成し、GitHub Release に
upload します。

reviewer から「download できる PR artifact が無い場合、何を確認すればよいか」
と聞かれた場合は、この document を参照します。

## Source Checkout で確認する場合

reviewer が対象 OS 上で build できる場合は、この方法を使います。

```sh
gh pr checkout <number> --repo oyoguhito/fpasoterm
npm install
npm run check
```

GitHub CLI が無い場合:

```sh
git fetch origin <branch-name>
git switch -c review-<number> origin/<branch-name>
npm install
npm run check
```

## Windows Direct Binary の確認

direct `fpasoterm.exe` の挙動に関係する変更では、PR branch から Windows binary
を build して確認します。

debug build:

```powershell
cargo build --manifest-path src-tauri/Cargo.toml
.\src-tauri\target\debug\fpasoterm.exe --help
.\src-tauri\target\debug\fpasoterm.exe --size 1200x800 --title "PR test" --titlebar-color "#2e7d32"
```

release build に近い local build:

```powershell
npm run build
.\src-tauri\target\release\fpasoterm.exe --help
```

期待する挙動:

- `--help` は GUI window を開く前に終了し、usage text を表示する。
- `--size` は起動時の window size を変更する。
- `--title` は custom titlebar の文字を変更する。
- `--titlebar-color` は custom titlebar の色を変更する。

## Artifact が無い場合

PR に download できる artifact が無い場合、review 対象は PR branch そのものです。
reviewer は PR branch を checkout し、依存関係を install し、local check を実行し、
対象 OS 上で debug build または release build を作成して確認します。

tag release asset は PR artifact の代わりには使いません。tag release asset は
version tag から build されたものであり、pull request branch から build された
ものではないためです。

## PR Artifact が必要な場合

reviewer が pull request ごとに `.exe`、`.msi`、`.deb`、`.rpm`、`.dmg`、
app archive を download して確認する必要がある場合は、別途 `pull_request`
用の artifact workflow を追加します。この workflow は PR branch から build して
GitHub Actions artifact として upload しますが、GitHub Release には publish しません。

正式な version release には、tag based の `Release` workflow を使い続けます。
