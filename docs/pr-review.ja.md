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

`git fetch` は remote reference を取得するだけで、現在の working tree は変更しません。
build前には必ず `git switch` または `git checkout` を実行してください。

## Windows MSI の確認

PR #41では下記のbranch名に `release-v1.5.0` を使います。以後のPRでは、そのPRの
head branch名へ置き換えてください。repository rootでPowerShellから実行します。

```powershell
git fetch origin release-v1.5.0
git switch --detach origin/release-v1.5.0
git status --short
git log -1 --oneline
npm ci
npm run check
npm run build:artifacts -- --bundles-only
```

`git status --short` が空であることと、最後の `git log` の出力により、package化する
revisionを確認できます。`git fetch` だけではcurrent branchは変わらないため、build
手順としては不十分です。

まずは古いStart menu、pinned shortcut、Path上のexecutableを起動しない、生成済みの
direct binaryを確認します。

```powershell
.\src-tauri\target\release\fpasoterm.exe --version
.\src-tauri\target\release\fpasoterm.exe
```

application内の `Help` を開き、`Config:` が編集対象のfileを指すことと、PRのUI変更が
表示されることを確認してください。

未releaseのPRでは、既にinstall済みのbuildと同じversionであることがあります。MSIを
installする前に全fpasoterm processを閉じ、Windows Installerへsame-version packageの
再installを明示します。

```powershell
Get-Process fpasoterm -ErrorAction SilentlyContinue | Stop-Process -Force
$msi = Get-ChildItem .\artifacts\*.msi | Sort-Object LastWriteTime -Descending | Select-Object -First 1
& msiexec.exe /i $msi.FullName REINSTALL=ALL REINSTALLMODE=vomus
if ($LASTEXITCODE -notin 0, 3010) { throw "MSI install failed: $LASTEXITCODE" }
```

終了code `3010` はWindows再起動が必要であることを表します。この後、更新されたStart
menu shortcutからinstalled appを起動します。機能確認だけであれば、上記direct binary
の起動が、PR branchを実行していることを最も確実に確認できます。

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
