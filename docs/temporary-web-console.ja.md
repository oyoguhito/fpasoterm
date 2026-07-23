# Temporary Web Console

temporary web console は、一時的にリモート側の出力を取得するための方向性です。

sync folder integration とは別物です。sync folder は共有ローカルフォルダにファイルを残します。temporary web console は、ユーザーが明示的に有効化している間だけ最近の出力を参照できる入口を開き、不要になったら閉じます。

## 目的

remote fpasoterm session の出力を、メンテナンスや review のために一時的に確認したい場合に使います。network drive や永続的な共有フォルダへ残したくない場合の選択肢です。

初期 scope:

- 最近の選択出力、diagnostics、必要に応じた terminal log excerpt の read-only 参照
- browser 表示では ANSI CSI/OSC など一般的な terminal control sequence を除去
- 明示的な start / stop
- 短い有効期限
- random access token
- browser から shell input は送らない
- public network へ自動公開しない

## Security Model

この機能は既定で disabled にします。

初期実装では `127.0.0.1` のみに bind し、random token 付き URL を表示します。

```text
http://127.0.0.1:<port>/?token=<random-token>
```

別端末からアクセスしたい場合は、SSH port forwarding、Tailscale、WireGuard、VPN などユーザーが管理する private path を使います。fpasoterm が firewall port を自動で開けることはしません。

token は memory のみに保持し、temporary web console 停止時に破棄します。設定された TTL を過ぎた場合も自動終了します。

## 非目標

- 初期実装では browser から terminal input を送らない。
- 永続的な cloud storage は使わない。
- OAuth は必須にしない。
- 既定では public sharing しない。
- 常時起動 server にはしない。

## 設定

```toml
[webConsole]
enabled = false
bind = "127.0.0.1"
port = 0
ttlSeconds = 900
maxBytes = 1048576
allowTerminalInput = false
```

`port = 0` は OS に空き local port を選ばせる指定です。

設定例は次の file にあります。

```text
examples/config/web-console.toml
```

## 起動時の一時指定

```sh
fpasoterm --web-console
fpasoterm --web-console --web-console-ttl 900
```

`--web-console` は、その起動だけ titlebar の `Web` menu を有効にします。HTTP server 自体は自動起動しません。

titlebar には次の menu が表示されます。

```text
Web Console -> Start
Web Console -> Copy URL
Web Console -> Stop
```

## 取得手順

1. `[webConsole].enabled = true` または `--web-console` で fpasoterm を起動します。
2. 出力を持っている fpasoterm 側で `Web` -> `Start` を選択します。
3. 生成された URL をコピーします。`Start` 時に自動で clipboard へコピーされ、`Copy URL` でも再コピーできます。
4. 別端末からアクセスする場合は、private tunnel や VPN route を用意します。
5. browser で URL を開きます。
6. 必要な出力をコピーします。
7. `Web` -> `Stop` で temporary web console を停止します。

この方針により、長期同期ではなく、メンテナンスとデバッグのための一時取得に限定できます。
