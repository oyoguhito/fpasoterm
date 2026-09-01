# SSHFS mount

FpasoTermはlocalにinstallされている`sshfs` commandでremote directoryをmountできます。SSH serverやfile copy機能をFpasoTerm自身が実装するものではありません。

**Sync > SSHFS Mounts**を開き、host、user、SSH port、absolute remote path、mount nameを入力します。managerは対応する全OSで、使用中のFpasoTerm window内のmodalとして開きます。Linux/macOSのlocal pathは使用中のFpasoTerm設定directory配下の`User/mounts/<name>`です。Windowsでは未使用のdrive letter（例: `Z:`）を自動的に割り当てます。terminalや他のlocal applicationから結果のpathを使用できます。

identityとpasswordを空欄にした場合、SSHFSは`~/.ssh/config`、default key、ssh-agentを含む通常のSSH authenticationを使用します。任意のidentity file pathはこのSSHFS commandにだけ渡します。任意のpasswordは`-o password_stdin`でstandard inputへ渡し、実行後にUIからclearします。config、log、sync fileには保存しません。

事前にSSHFSをinstallしてください。Linuxではpackage managerの`sshfs`、macOSではmacFUSEとSSHFS、WindowsではSSHFS-WinとWinFspが一般的です。password modeは利用中のSSHFS実装が`password_stdin`をsupportする必要があります。

Windowsでは、FpasoTermはSSHFS-Winが対応するディスク型network driveとして未使用のdrive letterを割り当てます。bundled Cygwinの`sshfs.exe`を直接起動しません。認証は使用中のFpasoTerm windowを親とする、Explorerや`net use`と同じSSHFS-WinのWindows credential dialogで行います。必要に応じてそのdialogまたはWindows Credential Managerを使用してください。identity-file欄はSSHFS-Winのmapped driveがmount単位の指定をsupportしないためWindowsでは受け付けず、SSHFS-Winが対応するkey設定を使用してください。managerを開いた直後のstatusには、実際に確認したSSHFS-Win pathが表示されます。PowerShellでの確認例です。

remote rootをmountする場合はremote pathに`/`を入力します。FpasoTermはこれを末尾separatorなしのSSHFS-Win root UNC形式`\\sshfs.r\\user@host!port`へ変換します。subdirectoryの場合は`/home/user/project`のようなabsolute pathを入力してください。

```powershell
Test-Path "$env:ProgramFiles\SSHFS-Win\bin\sshfs.exe"
& "$env:ProgramFiles\SSHFS-Win\bin\sshfs.exe" --version
```

標準以外の場所にinstallしている場合は、`FPASOTERM_SSHFS_PATH`に`sshfs.exe`のfull pathを設定してからFpasoTermを再起動してください。SSHFS-Winの標準`bin` directoryは[公式README](https://github.com/winfsp/sshfs-win)にも記載されています。

FpasoTermはsecretを含まないmount情報を`User/mounts/sshfs-mounts.json`へ保存するため、managerを閉じて再度開いても項目を復元してUnmountできます。Windowsでは割り当てたdrive letterも保存します。passwordは保存しません。active managed mountはterminal titlebarに`SSHFS (n)`として表示します。terminal windowを閉じる際はmountを残す前に確認します。Unmountも同じmanagerでmount nameを指定します。Linux/macOSでFpasoTermがUnmountできるのは自身の`User/mounts`配下だけです。Windowsでは記録済みdrive letterのみUnmountします。

SSHFS-Winでは通常のUnmount後もnetwork driveが残る場合があります。FpasoTermはまず通常のWindows解除APIを実行し、driveが消えたことを確認します。残っている場合だけ、`sshfs.exe`を終了して再解除する確認dialogをWindows標準UIで表示します。この強制復旧は、同じWindows userで利用できる他のSSHFS-Win mountも切断する可能性があります。他のmountを残す必要がある場合はCancelしてください。driveが実際に解除されたことを確認するまで、mount recordは削除しません。
