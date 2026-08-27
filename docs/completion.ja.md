# コマンド補完

fpasoterm は Bash、Zsh、Fish、PowerShell 向けのcompletion scriptを出力できます。
CLI optionと`--completion`の値を補完し、Bash/Zshでは`--profile`とplugin指定時に
ローカルのprofile/plugin一覧も候補にします。

```sh
fpasoterm --completion bash
fpasoterm --completion zsh
fpasoterm --completion fish
fpasoterm --completion powershell
```

このcommandはscriptを標準出力へ書き出すだけです。terminal windowの起動や設定変更は行いません。fpasoterm専用の永続completion fileを導入・削除する場合は次を使います。

```sh
fpasoterm --completion-install bash
fpasoterm --completion-uninstall bash
```

`bash`は`zsh`、`fish`、`powershell`へ置き換えられます。install/uninstallはfpasotermが管理するuser fileだけを操作し、system completion fileは変更しません。

## 更新時のcompletion

アプリを更新しても、既に導入したcompletion scriptが動かなくなるための再導入は不要です。永続completionはuser directoryへcopyしたfileであるため、新しいCLI optionや値をTab補完の候補へ追加したい場合だけ、使用するshellに対して再度installを実行してください。

```sh
fpasoterm --completion-install bash
fpasoterm --completion-install zsh
fpasoterm --completion-install fish
fpasoterm --completion-install powershell
```

更新後はshellを再起動します。PowerShellでは新しいconsoleを開かずに`. $PROFILE`でprofileを再読込できます。`--completion-uninstall <shell>`はcompletionを削除するためだけのcommandであり、通常の更新時には必要ありません。

## Bash

現在のshellだけで有効にする場合:

```bash
source <(fpasoterm --completion bash)
```

永続的に導入する場合は`fpasoterm --completion-install bash`を実行します。`~/.local/share/bash-completion/completions/fpasoterm`（または`XDG_DATA_HOME`配下）へ導入され、`fpasoterm --completion-uninstall bash`で削除できます。

## Zsh

現在のshellだけで有効にする場合:

```zsh
source <(fpasoterm --completion zsh)
```

永続的に導入する場合は`fpasoterm --completion-install zsh`を実行します。`~/.zfunc/_fpasoterm`へ導入され、`fpasoterm --completion-uninstall zsh`で削除できます。

`~/.zfunc`が`fpath`に含まれていない場合は、`.zshrc`の
`autoload -Uz compinit && compinit`より前へ`fpath=(~/.zfunc $fpath)`を追加してください。

## Fish

現在のshellだけで有効にする場合:

```fish
fpasoterm --completion fish | source
```

永続的に導入する場合は`fpasoterm --completion-install fish`を実行します。`~/.config/fish/completions/fpasoterm.fish`（または`XDG_CONFIG_HOME`配下）へ導入され、`fpasoterm --completion-uninstall fish`で削除できます。

Fishは次回以降のshellでこのfileを自動的に読み込みます。

## PowerShell

現在のPowerShell sessionだけで有効にする場合:

```powershell
fpasoterm --completion powershell | Out-String | Invoke-Expression
```

ユーザー環境へ永続的に導入する場合は次を実行します。

```powershell
fpasoterm --completion-install powershell
```

`User/completions`配下へscriptを配置し、利用可能なPowerShellのuser profile（`pwsh`とWindows PowerShell）すべてへfpasoterm専用の識別可能なblockを追加します。Documentsのredirectにも対応します。`fpasoterm --completion-uninstall powershell`はscriptとこのblockだけを削除します。
profileの内容がこの管理blockだけの場合は空fileを残さずprofile自体を削除します。他のprofile設定がある場合は保持します。

fpasoterm windowの再起動ではPowerShell profileは読み直されません。install後にPowerShell consoleを一度閉じて開き直すか、現在のconsoleで直ちに有効にするには次を実行します。

```powershell
. $PROFILE
```

`-NoProfile`を付けてPowerShellを起動している場合はprofileを読み込まないため、上記のようにcompletion scriptをsourceするか、`-NoProfile`なしでPowerShellを起動してください。

PowerShellが「このシステムではスクリプトを実行できません」と表示する場合は、effective policyを確認し、現在のuserだけでlocal scriptを許可します。administrator consoleは不要です。

```powershell
Get-ExecutionPolicy -List
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
. $PROFILE
```

organization policyが`CurrentUser`より優先される場合は、machine-wide bypassを設定せずdevice administratorへ確認してください。

installer artifactを直接使用する場合は、PowerShellへstdoutを返すconsole wrapperを使います。

```powershell
.\fpasoterm.cmd --completion powershell | Out-String | Invoke-Expression
```

`cmd.exe`にはBashやPowerShellと同等のprogrammaticな引数completion APIがありません。
Windowsでinteractive completionを使用する場合はPowerShellを使ってください。
