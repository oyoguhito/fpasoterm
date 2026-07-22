# Sync Folder

fpasoterm は、Google Drive for desktop、OneDrive、Dropbox、Syncthing、rsync などが同期しているローカルフォルダを使って、明示的に選択した clipboard text と diagnostics を共有できます。

fpasoterm は Google Drive API を呼びません。OAuth、API key、Google Cloud project は不要です。Google Drive は、fpasoterm がローカルフォルダに書いたファイルを同期するだけです。

## 設定

初めて設定する場合は、対話形式の setup を使えます。

```sh
fpasoterm --setup-sync
```

source checkout から実行している場合、Windows では `bin/fpasoterm` が Node.js script のため、次のように `node` 経由で実行します。

PowerShell:

```powershell
node .\bin\fpasoterm --setup-sync
```

cmd.exe:

```bat
node bin\fpasoterm --setup-sync
```

npm global install 済みの場合は、Windows でも次で実行できます。

```powershell
fpasoterm --setup-sync
```

この command は質問に答えるだけで `~/.config/fpasoterm/User/config.toml` の `[sync]` と `[logging]` を生成または更新します。既存の window、terminal、plugin 設定は残します。

ChromeOS で `shared` や `temp` など複数の folder を `Linux と共有` している場合、`--setup-sync` は書き込み可能な候補を一覧表示します。候補番号を入力するか、実際の path を直接入力してください。

### Sync channel

`Sync channel` は、同じ sync folder の中で同期データを分けるための名前です。通常は `default` のままで問題ありません。

同じ `path` と同じ `channel` を指定した fpasoterm 同士だけが、clipboard text、diagnostics、logs を同じ場所で共有します。ChromeOS と Windows で同じ clipboard sync を使いたい場合は、両方で同じ channel 名を指定してください。

例:

```text
default
```

通常用途。1 つの同期先を全端末で共有するだけならこれで十分です。

```text
work
```

仕事用だけ分けたい場合。

```text
chromeos-test
```

検証用。普段の同期データと混ぜたくない場合。

## Google Drive フォルダの準備

fpasoterm は Google Drive を直接 mount しません。先に OS 側で Google Drive をローカルフォルダとして見える状態にしてください。

### ChromeOS / Baguette

1. ChromeOS の Files app を開きます。
2. `Google Drive` -> `My Drive` の中に、Linux と共有する folder を作成します。例: `shared`、`temp`
3. 作成した folder を右クリックし、`Linux と共有` または `Share with Linux` を選択します。
4. Linux 側で次の path が見えることを確認します。

```sh
ls /mnt/chromeos/shared/GoogleDrive/MyDrive/shared
```

5. fpasoterm 用の同期フォルダとして、例えば次を指定します。

```text
/mnt/chromeos/shared/GoogleDrive/MyDrive/shared/fpasoterm-sync
```

Baguette では MyDrive 直下が見えても、Linux から MyDrive 直下に folder を作成できない場合があります。その場合は、ChromeOS Files app で個別に `Share with Linux` した folder 配下を使います。上の例では `shared` folder 配下です。

他の ChromeOS Linux 環境では `/mnt/shared/GoogleDrive/MyDrive/shared` または `/mnt/chromeos/GoogleDrive/MyDrive/shared` として見える場合があります。存在し、Linux から書き込める path を使ってください。

ChromeOS Files app で共有済み folder の名前を変更した場合、Linux 側の共有設定が新しい名前へ自動追従しないことがあります。`test` から `temp` へ rename した場合などは、rename 後の `temp` folder を改めて右クリックし、`Linux と共有` を実行してください。

`temp` folder を共有した場合は、同じ考え方で次のような path になります。

```text
/mnt/chromeos/shared/GoogleDrive/MyDrive/temp/fpasoterm-sync
```

どちらも見えない場合は、ChromeOS Settings の `Developers` -> `Linux development environment` -> `Manage shared folders` で Google Drive が Linux に共有されているか確認してください。

### macOS

1. Google Drive for desktop をインストールしてログインします。
2. Finder で Google Drive のローカルフォルダを確認します。
3. 多くの環境では次のような path になります。

```text
~/Library/CloudStorage/GoogleDrive-<account>/My Drive/fpasoterm-sync
```

`<account>` 部分は環境ごとに異なります。Finder から対象フォルダを Terminal に drag and drop すると実際の path を確認しやすいです。

### Windows

1. Google Drive for desktop をインストールしてログインします。
2. Explorer で Google Drive の drive letter または local folder を確認します。
3. Google Drive の中に `fpasoterm-sync` folder を作成します。
4. 多くの環境では次のような path になります。

```text
G:\My Drive\fpasoterm-sync
```

drive letter が `G:` 以外の場合は、その環境の実際の path を指定してください。日本語表示や設定によっては `G:\マイドライブ\fpasoterm-sync`、`D:\My Drive\fpasoterm-sync` などになる場合があります。

PowerShell で path を確認する例:

```powershell
Test-Path 'G:\My Drive'
Test-Path 'G:\マイドライブ'
```

`--setup-sync` で候補が出ない場合は、Explorer で見えている Google Drive folder の path を直接入力してください。

### Linux desktop

Google Drive 公式の Linux desktop client はありません。rclone mount、google-drive-ocamlfuse、Insync、Syncthing、Dropbox、rsync などで、fpasoterm から通常の directory として読み書きできる local folder を用意してください。

## 手動設定

`~/.config/fpasoterm/User/config.toml` に `[sync]` section を追加します。

```toml
[sync]
enabled = true
provider = "folder"
path = "~/Google Drive/fpasoterm-sync"
channel = "work"
clipboard = true
diagnostics = true
pasteRequiresConfirm = true
maxBytes = 1048576
ttlSeconds = 86400
```

同期したい別の fpasoterm でも同じ `path` と `channel` を指定します。Google Drive のローカルフォルダ名が異なる場合は、その環境の実際の path を指定してください。

ChromeOS/Baguette では次のように指定します。

```toml
path = "/mnt/chromeos/shared/GoogleDrive/MyDrive/shared/fpasoterm-sync"
```

別の ChromeOS Linux 環境で違う path に見えている場合は、存在する方を使います。

```toml
path = "/mnt/shared/GoogleDrive/MyDrive/shared/fpasoterm-sync"
path = "/mnt/chromeos/GoogleDrive/MyDrive/shared/fpasoterm-sync"
```

## 作成されるファイル

`channel = "work"` の場合、fpasoterm は次のファイルを読み書きします。

```text
<sync path>/work/clipboard.json
<sync path>/work/diagnostics.json
```

JSON には `kind`、`channel`、`sourceId`、`updatedAt`、`text` が入ります。

## 使用方法

sync が有効な場合、titlebar に次のボタンが表示されます。

titlebar の `Sync` menu から次の操作を選べます。

- `Copy Selection`: terminal の選択テキストを `clipboard.json` に書き込みます。選択が無い場合は現在のローカル clipboard text を書き込みます。
- `Pull to Clipboard`: `clipboard.json` を読み、text をローカル OS clipboard へコピーします。terminal へ直接 paste はしません。
- `Write Diagnostics`: 最近の fpasoterm diagnostics/debug log を `diagnostics.json` に書き込みます。terminal output log ではありません。

`Pull to Clipboard` は terminal に直接 paste しません。まずローカル OS clipboard にコピーするため、内容を確認してから明示的に paste できます。

## Terminal Output Logs

sync folder の diagnostics と terminal output logging は別機能です。titlebar の `Log Start` ボタンで raw terminal output を local log file に記録し、`Log Stop` で閉じます。既定では `~/.config/fpasoterm/User/logs` 配下へ保存します。

`--setup-sync` の `Store terminal output logs in the sync folder?` で `N` または Enter を選ぶと、terminal output log は同期フォルダへ置かれません。通常はこのままで構いません。

`y` を選ぶと、次の `Synced terminal log directory` の既定値は Google Drive などの同期フォルダ配下になります。例えば Windows では `G:\マイドライブ\fpasoterm-sync\logs` のように表示されることがあります。これは Windows 上のローカル path ですが、Google Drive for desktop によって他端末へ同期されます。

path には `~`、`%USERPROFILE%`、`$HOME` などを使えます。ただし、ChromeOS、macOS、Windows で同じ設定を共有する場合は、`~` または各 OS ごとの実 path を使う方が分かりやすいです。

log を同期フォルダに置きたい場合だけ次のように設定します。

```toml
[logging]
enabled = true
directory = "~/Google Drive/fpasoterm-sync/logs"
autoStart = false
maxBytes = 10485760
```

terminal 内からも同じ機能を制御できます。

```sh
printf '\033]777;log=start\a\r\n'
printf '\033]777;log=stop\a\r\n'
printf '\033]777;log=start;logPath=session.log\a\r\n'
```

PowerShell の場合:

```powershell
[Console]::Write("$([char]27)]777;log=start$([char]7)`r`n")
[Console]::Write("$([char]27)]777;log=stop$([char]7)`r`n")
```

## セキュリティ

同期されるのは、明示的にコピーした text と diagnostics だけです。terminal 全出力は自動同期しません。

terminal log には command output、prompt、その他の機密情報が含まれる可能性があります。`logging.directory` を同期フォルダに向ける場合は、そのフォルダの保護に注意してください。

初期実装では plain JSON と plain terminal log として保存します。機密情報を扱う場合は、同期フォルダ自体の保護に注意してください。必要であれば、今後の版で payload 暗号化を追加できます。
