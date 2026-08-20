# プラグイン

fpasoterm のプラグインは、terminal の準備後に renderer で動作するローカルの JavaScript または TypeScript file です。起動時メッセージ、terminal option の調整、diagnostics 連携など、個人用の小さな挙動変更に使えます。追加すると便利な workflow は、原則として本体ではなく plugin として実装します。本体の変更は terminal の正確性、platform integration、security、shell / multiplexer / TUI editorとの互換性に必要なものへ限定します。

plugin は高度なローカルカスタマイズ機能で、sandbox 化された extension 形式ではありません。fpasoterm は利用者が `--plugin-install` を明示した場合に限り公開portを取得できます。起動時やrenderer pluginから自動取得することはありません。

review済みの公開pluginは [fpasoterm-plugins ports repository](https://github.com/oyoguhito/fpasoterm-plugins) を使用してください。このrepositoryは公開catalog、`INDEX`、開発時のcheck、contribution processを管理します。利用者向けのlocal checkoutまたは指定fileからのinstallはfpasoterm本体CLIで行います。本書はfpasoterm本体のruntime contractと手動local plugin配置を説明します。

## セキュリティ

plugin は terminal UI と同じ renderer context で実行されます。内容を確認して信頼できるローカル file だけを有効にしてください。出所不明の plugin は有効にせず、password、access token、private path、その他の秘密情報を plugin file に書かないでください。

## plugin directory

active な `config.toml` と同じ場所にある `plugins` directory 配下へ、`.js` または `.ts` file を配置します。

```text
~/.config/fpasoterm/User/
├── config.toml
└── plugins/
    ├── welcome-banner.ts
    └── status-banner.ts
```

subdirectory も使えます。設定に書く plugin path は常に `User` directory からの相対 path です。たとえば `plugins/team/banner.ts` のように指定します。

TypeScript plugin は起動時に変換され、次の directory に cache されます。

```text
~/.config/fpasoterm/User/cache/plugins/
```

この cache の生成 file は編集せず、`User/plugins` 配下にある元の `.ts` file を編集してください。

## plugin version metadata

plugin source の comment に version と description を宣言できます。manifestや追加 directory は不要です。

```ts
// @fpasoterm-plugin version: 1.0.0
// @fpasoterm-plugin description: 簡潔な起動 message を表示する。
```

`version` は plugin 固有のローカル release 識別子です。一貫性のため `1.0.0` のような semantic version を推奨します。実行中 fpasoterm 本体の version を返す `api.version` とは別です。headerの無い既存 plugin は従来どおり動作し、CLIでは `(not declared)` と表示します。

## plugin の有効化

fpasoterm は最初の通常起動時に `User/plugins` を作成します。手動管理するlocal pluginの場合は、そこへ信頼できるsourceを配置して設定で有効化します。

`~/.config/fpasoterm/User/config.toml` で有効にします。

```toml
[plugins]
enabled = [
  "plugins/welcome-banner.ts",
  "plugins/status-banner.ts",
]
```

plugin list または plugin source を変更した後は fpasoterm を再起動してください。`enabled` に書かれた順番で読み込まれます。

CLIでは、packaged Windows/macOS/Linux binaryを含めて、file nameを指定してlistを更新できます。

```sh
fpasoterm --enable-plugin welcome-banner,status-banner
fpasoterm --disable-plugin status-banner
fpasoterm --show-config
```

すべてのCLIでplugin管理用の明示的な表記も使えます。

```sh
fpasoterm --plugin-path
fpasoterm --plugin-list
fpasoterm --plugin-info welcome-banner
fpasoterm --plugin-uninstall welcome-banner
fpasoterm --plugin-enable welcome-banner
fpasoterm --plugin-disable welcome-banner
fpasoterm --plugin-enable-all
fpasoterm --plugin-disable-all
```

`--plugin-list` はactiveな `User/plugins` directoryだけを対象にする **local list** です。GitHubや公開port catalogへの問い合わせは行いません。remote catalogは `--plugin-search [query]` を使用してください。検出した fileと宣言されたversion、および `enabled` を表示します。`--plugin-enable` と `--plugin-disable` は、既存の `--enable-plugin` と `--disable-plugin` の alias です。
`--plugin-info <file>` は window を起動せずに、source path、有効状態、宣言version、description、load status、renderer URL を表示します。localの`--plugin-*` selectorでは、`plugins/` prefixと`.js`/`.ts` suffixを省略できます。たとえば`welcome-banner`や`appearance/teal`を指定できます。`.js`と`.ts`の両方が一致する場合はextensionまたはより具体的なpathを指定してください。
`--plugin-uninstall <file>` は `User/plugins` のlocal plugin sourceを1件またはcomma区切りで削除し、生成済みcacheと同じ`plugins.enabled` entryも削除します。公開catalogには接続せず、曖昧なname、traversal、symlink化されたplugin fileはerrorにします。削除後は開いているfpasoterm windowを再起動してください。他のplugin変更optionとの同時指定はできません。
`--plugin-enable-all` は検出済みの全 `.js` / `.ts` fileを有効化します。`User/plugins`にplugin sourceが無い場合は、空のlistを成功扱いにせずerrorを表示します。`--plugin-disable-all` は `plugins.enabled` だけを空にし、plugin sourceやcache fileは削除しません。

## 公開portの直接install

portを選ぶ前に公開metadata indexを検索できます。これは公式`INDEX`だけを取得し、plugin sourceのdownloadや実行は行いません。

```sh
fpasoterm --plugin-search
fpasoterm --plugin-search teal
```

`--plugin-search` は公式GitHub `INDEX`を表示する **remote search** で、出力にもsourceを表示します。`fpasoterm-plugins` 内の `ports` command はlocal `INDEX`検索、port開発、検証に使えますが、利用者がpluginをinstallするためには不要です。

公式の [oyoguhito/fpasoterm-plugins](https://github.com/oyoguhito/fpasoterm-plugins)
repositoryから、必要なportだけを本体CLIで直接取得できます。ports checkout全体やNode.jsは不要です。

```sh
fpasoterm --plugin-install appearance/teal
fpasoterm --plugin-install appearance/teal --enable
fpasoterm --plugin-uninstall appearance/teal
```

最初のcommandは指定portのsourceだけを`User/plugins`へcopyし、reviewできるよう無効のままにします。`--enable`を明示した場合だけ`plugins.enabled`へ追加します。既存fileは`--force`を指定しない限り置き換えません。installerは固定の公式repositoryにHTTPSで接続し、port/source path、manifest metadata、source size、期待するfpasoterm plugin headerを検証します。download後もpluginはrendererで動作するため、有効化前に内容を確認して信頼できるものだけを使用してください。

### local checkout / fileからのinstall

clone、review、開発中のlocal portは、`npm run ports install` を使わずfpasoterm本体CLIからinstallできます。

```sh
git clone https://github.com/oyoguhito/fpasoterm-plugins.git
fpasoterm --plugin-install appearance/teal \
  --plugin-ports-dir ./fpasoterm-plugins --enable
```

`--plugin-ports-dir` には `ports/` を含むcheckoutを明示します。指定しない`--plugin-install`は公式GitHub repositoryから対象portを取得します。指定した場合はlocal installerとして`port.toml`、metadata、必要なfpasoterm versionを検証し、該当plugin sourceだけをcopyします。local経路はnetworkへ接続しません。

ports checkout外にある信頼済みの単独pluginをcopyする場合は、source fileを明示します。

```sh
fpasoterm --plugin-install-file ~/work/my-plugins/team-banner.ts --enable
```

どちらのlocal commandもfpasoterm plugin headerとrenderer API markerを持つ通常の`.js`または`.ts` fileだけを受け付けます。既存fileは`--force`を指定しない限り置き換えません。

subdirectory に同名 file がある場合は、`team/status-banner.ts` のように `plugins` からの相対 path を指定してください。

### Windows packaged binary

MSI/EXEでは`fpasoterm.exe --plugin-install <category/name>`を`--plugin-ports-dir`の有無にかかわらず使用でき、`--plugin-install-file`も直接使用できます。Node.jsは不要です。Windows source checkoutで実行する場合だけ`fpasoterm.cmd`を使用します。

起動時は、trusted な `User/plugins` source または生成されたTypeScript cacheをTauriのlocal asset protocol経由で読み込みます。標準の`User` directoryが対象です。pluginを有効化または編集した後は、対象のfpasoterm windowを閉じて再起動してください。読み込みerrorを調べる場合は、`fpasoterm --foreground --console-diagnostics`で起動し、`plugin loaded` または `failed to load plugin` を確認します。

各pluginは個別のfunction scopeで評価します。そのため、複数のpluginがそれぞれtop-levelで`const`や`let`を使用しても衝突しません。共有APIには`window.fpasotermPluginApi`を使用してください。

## plugin API

対応 API は [`docs/fpasoterm-plugin.d.ts`](fpasoterm-plugin.d.ts) に定義されています。この repository 内で TypeScript plugin を作成する場合は、先頭に次を追加します。

```ts
/// <reference path="../../docs/fpasoterm-plugin.d.ts" />
```

install 後の plugin では declaration file をローカルへコピーし、reference path を調整できます。API は `window.fpasotermPluginApi` として利用でき、次を提供します。

- `terminal`: text の出力、terminal の focus、対応する terminal option の変更。
- `fitAddon`: layout 関連 option を変更した後の `fit()` 実行。
- `config`: `plugins.enabled` を含む解決済み runtime config の参照。
- `log(message)`: plugin prefix 付き diagnostics の出力。
- `version`: 実行中の fpasoterm version と build identifier の参照。
- `onReady(callback)`: terminal backend の起動成功後に一度だけ code を実行。
- `registerCommand(id, title, handler)`: 既存 hamburger menu の `Plugins` submenu配下へ
  action buttonを追加する。loaded pluginが一つ以上commandを登録した場合だけsubmenuを表示する。pluginを
  有効化しただけでは実行するhandlerがないため、buttonは追加しない。

現在のrepository内sampleはすべて一つのcommandを登録します。最新版の`hello.ts`、`status-banner.ts`、
`theme.ts`、`welcome-banner.ts`を有効化すると、4つのbuttonが表示されるのが正しい動作です。古いlocal sampleが
commandを登録しない場合もplugin自体は有効で起動時処理を実行できますが、意図してmenuには表示しません。sourceと
versionは`--plugin-info <file>`で確認し、local plugin fileを差し替えた後はwindowを再起動してください。

plugin は小さく防御的に実装してください。読み込み error は diagnostics に記録され、後続の有効 plugin の読み込みは継続します。ただし、実行中の不正な plugin は renderer に影響する可能性があります。

登録した command は既存 menu の Tab / 矢印キー操作で選択できます。`Ctrl+Shift+P` は `Log Show` に割り当て済みのため維持します。将来 command palette を追加する場合も、同じ command registry を plugin source の変更なしに利用できます。

## Sample と Ports

repository内の`examples/plugins/`は最小のAPI参照用です。install可能なsample、appearance theme、metadata、compatibility validation、updateは [fpasoterm-plugins](https://github.com/oyoguhito/fpasoterm-plugins) で管理します。

`config.toml` の全設定は [設定](config.ja.md) を参照してください。
