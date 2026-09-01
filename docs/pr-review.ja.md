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
git fetch origin pull/<number>/head:review-pr-<number>
git switch review-pr-<number>
npm install
npm run check
```

`git fetch` は remote reference を取得するだけで、現在の working tree は変更しません。
build前には必ず `git switch` または `git checkout` を実行してください。

Node.js 22+、Rust stable、対象OSのnative build toolが必要です。macOSではXcode
Command Line Tools、WindowsではVisual Studio Build Toolsの**Desktop development with
C++**とMicrosoft Edge WebView2 Runtimeを導入してください。local checkoutが無い場合は
`git clone https://github.com/oyoguhito/fpasoterm.git`後に`cd fpasoterm`を実行します。

## Windows MSI の確認

repository rootでPowerShellから実行します。PRのhead branch名を推測せず、PR numberから
取得するrefを使います。

```powershell
git fetch origin pull/<number>/head:review-pr-<number>
git switch review-pr-<number>
git status --short
git log -1 --oneline
npm ci
npm run check
npm run build:bundles
```

`git status --short` が空であることと、最後の `git log` の出力により、package化する
revisionを確認できます。`git fetch` だけではcurrent branchは変わらないため、build
手順としては不十分です。

まずは古いStart menu、pinned shortcut、Path上のexecutableを起動しない、生成済みの
direct binaryを確認します。CLI出力はPowerShellがGUI-subsystem executableの終了を待つよう、
生成された`.cmd` wrapperを使用します。

```powershell
.\src-tauri\target\release\fpasoterm.cmd --version
.\src-tauri\target\release\fpasoterm.exe
```

CLI startupを変更するPRでは、実際のNode launcherも確認します。status lineを表示し、
windowを待たずPowerShell promptが戻ることを確認してください。

```powershell
node .\bin\fpasoterm
Get-Content "$env:LOCALAPPDATA\fpasoterm\launcher.log" -Tail 40
```

local buildが必要な場合だけlogに`cargo-build-start` / `cargo-build-complete`が出て、
その後に`desktop-spawned`とelapsed timeが記録されます。

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

## macOS App Bundle の確認

repository rootのTerminalで実行します。reviewする実機でnative buildします。Apple Silicon
ではarm64、Intel Macではx64が生成されます。

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

CLI launcherの挙動確認には`node ./bin/fpasoterm`を使います。cached runtimeまたはCargo
buildのstatusを表示し、windowが開く前にTerminal promptが戻ることを確認してください。
compilerまたはapplication outputを待つ必要がある場合だけ、`--foreground --console-diagnostics`
を追加します。

iconやFinder/App bundleの確認は、local buildしたapp bundleを別に開きます。

```sh
open -n ./src-tauri/target/release/bundle/macos/fpasoterm.app
```

unsigned local buildをmacOSがblockした場合はFinderの**開く**を実行し、Privacy & Security
で許可します。PR branchの代わりに古いtagのDMGを使わないでください。

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
