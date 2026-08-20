# セキュリティ

FpasoTerm はuserが選択したshellを起動するため、そのuser accountと同じ権限を持ちます。terminal input、plugin、sync command deliveryはsecurity-sensitiveな機能として扱ってください。

## 信頼境界

### Local plugin

`~/.config/fpasoterm/User/plugins/`で有効化したfileはterminal renderer内でJavaScriptとして実行されます。plugin APIを参照し、現在のuserとして操作できます。内容をreviewしたlocal fileだけを有効化してください。見覚えのあるfile名や未reviewのrepositoryだけを理由に有効化してはいけません。

### Sync folder Broadcast

remote Broadcastは既定で無効です。`fpasoterm --setup-sync`は32文字以上の`sync.commandSecret`を生成します。同じsecretは信頼できるdeviceとuser accountだけに設定してください。FpasoTermはsync command fileへHMAC-SHA-256署名を付け、署名がない、または一致しないfileを無視します。

secretはdeviceごとのlocal `config.toml`に保存され、shared folderには保存しません。Git commit、screenshot、Issue、公開設定fileへ含めないでください。secretをrotateする場合は`--setup-sync`を再実行し、trusted deviceのすべてを更新してからsync Broadcastを再開してください。

HMACはsecretを持つdeviceがcommandを作成したことを確認します。shared folderの非公開化、diagnostics/logの暗号化、malwareに侵害されたdeviceの保護は行いません。sync folderはprivateにし、writeできるuserを制限してください。

### Broadcast確認

Broadcast dialogは`rm`や`git reset --hard`など一部の破壊的patternで確認を求めます。これは誤操作防止であり、command authorizationではありません。CLI Broadcast、plugin、shell alias、heuristicに一致しないcommandは引き続き実行できます。送信前にcommandとtargetを確認してください。

## 報告と保守

secret、private log内容、sync path、command secretをpublic Issueへ掲載しないでください。GitHubのprivate vulnerability reportingが利用できる場合はそれを使い、利用できない場合はrepository ownerへprivateに連絡してください。

CIではrepository secret scan、`npm audit --omit=dev`、JavaScript/RustのCodeQL、Rust dependency向けの`cargo audit`を実行します。これらは既知riskを減らすものであり、FpasoTerm、plugin、OSを最新に保つ代わりにはなりません。
