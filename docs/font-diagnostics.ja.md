# Font / Glyph Diagnostics

window menu から **Font / Glyph Test** を選択します。既存のdiagnostics panelを
表示するだけで、terminal sessionや保存済み設定は変更しません。

panelには解決済みの次の値を表示します。

- `terminal.fontFamily`
- `terminal.fontSize`
- `terminal.lineHeight`

これらと同じfont設定で、次の代表文字列を描画します。

- 日本語・中国語・韓国語を含むCJK文字
- 濁点・半濁点を含む半角カナ
- 通常線と二重線の罫線文字
- 矢印、数学記号、status用記号
- Nerd Fontのprivate-use glyphとUnicode code point

これは表示確認用であり、fontをinstallする機能ではありません。glyphが無い場合は
fallback glyph、空cell、tofu boxなどで表示されます。これは設定したfont stackが対象glyphを
提供していないことを示します。適切なfontをinstallまたは`terminal.fontFamily`へ設定し、
fpasotermを再起動してから再度確認してください。

Linux/ChromeOS の既定font stackは、罫線・block文字のcell幅を安定させるため、導入済みの
Noto/DejaVu等幅fontを先頭にします。Nerd Fontはprivate-use glyph用のfallbackです。過去に
配布したNerd Font優先の既定値は起動時に移行します。利用者が明示的に指定した`fontFamily`は
変更しません。

既定のfont stackにはNoto CJKの日本語・韓国語・中国語候補を含めますが、OSにinstallされて
いないfontは利用できません。韓国語sampleがtofu boxになる場合は、韓国語に対応するCJK fontを
OS側でinstallしてからfpasotermを再起動してください。Linuxでは、`fc-match 'Noto Sans CJK KR'`
の結果が無関係なfontへfallbackしている場合、その候補fontはinstallされていません。

ChromeOS/Baguetteを含むDebian系Linuxでは、Noto CJK font packageをinstallし、font cacheを
更新して確認できます。

```sh
sudo apt install fonts-noto-cjk
fc-cache -f
fc-match 'Noto Sans CJK KR'
```

既存の`config.toml`は新しい既定値より優先されます。`terminal.fontFamily`を明示している
場合は、その一行を削除して現在の既定fallback stackを使うか、`Noto Sans CJK KR`を含むstackへ
置き換えてください。fontまたは`config.toml`を変更した後はfpasotermを再起動します。

## Windows

Windowsでも、Nerd FontをWindowsへinstallすればNerd Font glyphを表示できます。信頼できる
配布元からNerd Fontの`.ttf`または`.otf`を取得して展開し、font fileを右クリックして
**Install** または **Install for all users** を選択します。**Settings > Personalization > Fonts**
で、選択したNerd Fontの*正確なfamily名*が一覧にあることを確認します。font file名とCSSで指定する
family名は一致しない場合があります。次のPowerShellでも、代表的なNerd Fontのinstall済みfamily名を
列挙できます。

```powershell
Add-Type -AssemblyName PresentationCore
[Windows.Media.Fonts]::SystemFontFamilies |
  Where-Object Source -match 'Nerd|Caskaydia|JetBrains|Meslo|FiraCode|Hack' |
  ForEach-Object Source
```

fpasotermを再起動してから **Font / Glyph Test** を開いてください。

既に`terminal.fontFamily`を指定している場合は、installしたfont familyを先頭へ追加します。
例:

```toml
[terminal]
fontFamily = "\"CaskaydiaCove Nerd Font Mono\", \"Symbols Nerd Font Mono\", \"JetBrainsMono Nerd Font\", Cascadia Mono, Consolas, monospace"
```

別のNerd Fontを利用する場合は、`CaskaydiaCove Nerd Font Mono`をWindowsで確認した正確なfamily名に
置き換えます。Nerd Fontではないfallback fontより前に指定し、fpasotermを完全に終了して再起動後、
panelの2つのNerd Font行を確認してください。この手順によりfont未導入と描画上の問題を区別できます。

`Nerd Font (Powerline):` と `Nerd Font (icons):` の行がtofu boxや別のprivate-use glyphではなく、
意図したiconとして表示されれば成功です。最小構成のWindowsでは韓国語などのlanguage関連fontが
optionalの場合もあります。CJK韓国語sampleも表示されない場合は、**Settings > Time & language >
Language & region** から韓国語のlanguage/font featureを追加してください。

previewは解決済みterminal設定を使うため、`config.toml`変更後、profile適用後、ChromeOS/Linux、
macOS、Windows間での表示差異の確認に使えます。`config.toml`、`window-state.json`、shell、
multiplexer sessionは変更しません。

## 動作確認

install後、font設定変更後、またはOS間の表示差異を確認する場合は、次を実施します。

1. fpasotermを起動し、window menuを開きます。
2. **Font / Glyph Test** を選択します。
3. `CJK:` 行が次の文字列として表示されることを確認します。

   ```text
   CJK: 日本語 漢字 ひらがな カタカナ 中文 한국어
   ```

4. 日本語・中国語・韓国語のglyphが表示され、cell幅が一貫していることを確認します。tofu box、
   空cell、または明らかに異なるfallback fontは、設定したfont stackにglyphが無い目印です。
5. 必要に応じて `Half-width kana:`、`Box drawing:`、`Symbols:`、`Nerd Font:` 行も確認します。

`npm test`では、この固定のCJK sampleがrenderer sourceに含まれることも確認します。ただし、
自動testではOSに必要なfontがinstallされているかまでは判定できないため、panelでの目視確認を
表示に関する受け入れ確認として使用します。
