# Font And Glyph Diagnostics

Open the window menu and select **Font / Glyph Test**. fpasoterm opens the
existing diagnostics panel without changing the terminal session or its saved
configuration.

The panel displays the active resolved values for:

- `terminal.fontFamily`
- `terminal.fontSize`
- `terminal.lineHeight`

It renders representative text using those same font values:

- CJK text: Japanese, Chinese, and Korean characters
- Half-width kana, including voiced marks
- Light and double box-drawing characters
- Common arrows, mathematical symbols, and status symbols
- Nerd Font private-use glyphs and their Unicode code points

This is a visual check, not a font installation tool. A missing glyph normally
appears as a fallback glyph, blank cell, or tofu box. That result indicates the
configured font stack does not supply that glyph. Install or configure an
appropriate font in `terminal.fontFamily`, then restart fpasoterm and open the
test again.

On Linux and ChromeOS, the default stack starts with installed Noto/DejaVu
monospace fonts so terminal cell width remains stable for box and block art.
Nerd Fonts are fallback fonts only. Existing configurations that use the old
shipped Nerd-Font-first default are migrated at runtime; explicitly selected
font families are not changed.

The default stack includes Noto CJK Japanese, Korean, and Chinese candidates,
but it cannot use a font that is absent from the operating system. If the
Korean sample is a tofu box, install an OS CJK font that supports Korean, then
restart fpasoterm. On Linux, `fc-match 'Noto Sans CJK KR'` is a useful
diagnostic: a result that falls back to an unrelated font means that candidate
is not installed.

For ChromeOS/Baguette and other Debian-based Linux environments, install the
Noto CJK font package and rebuild the font cache:

```sh
sudo apt install fonts-noto-cjk
fc-cache -f
fc-match 'Noto Sans CJK KR'
```

An existing `config.toml` takes precedence over new defaults. If it has an
explicit `terminal.fontFamily`, remove that one setting to use the current
default fallback stack, or replace it with a stack that includes `Noto Sans CJK
KR`. Restart fpasoterm after changing either fonts or `config.toml`.

## Windows

Windows can render Nerd Font glyphs when a Nerd Font is installed in Windows.
Download a trusted Nerd Font `.ttf` or `.otf` file, extract it if needed, then
right-click the font file and choose **Install** or **Install for all users**.
In **Settings > Personalization > Fonts**, verify the *exact family name* of
the chosen Nerd Font. Restart fpasoterm and open **Font / Glyph Test** again.
The font file name is not necessarily its CSS family name. PowerShell can list
the installed family names that match common Nerd Font names:

```powershell
Add-Type -AssemblyName PresentationCore
[Windows.Media.Fonts]::SystemFontFamilies |
  Where-Object Source -match 'Nerd|Caskaydia|JetBrains|Meslo|FiraCode|Hack' |
  ForEach-Object Source
```

If a custom `terminal.fontFamily` is already configured, prepend the installed
font family. For example:

```toml
[terminal]
fontFamily = "\"CaskaydiaCove Nerd Font Mono\", \"Symbols Nerd Font Mono\", \"JetBrainsMono Nerd Font\", Cascadia Mono, Consolas, monospace"
```

Replace `CaskaydiaCove Nerd Font Mono` with the exact name reported by Windows
when using a different Nerd Font. Put that name before non-Nerd fallback fonts,
fully exit fpasoterm, start it again, then check both Nerd Font lines in the
panel. This procedure also distinguishes a missing font from a rendering issue.

The `Nerd Font (Powerline):` and `Nerd Font (icons):` lines should then show
the intended icons instead of tofu boxes or unrelated private-use glyphs.
Windows language-associated fonts can also be optional on a minimal install;
add the Korean language/font feature in **Settings > Time & language > Language
& region** if the Korean CJK sample remains unavailable.

The preview uses the resolved terminal configuration, so it is useful after
changing `config.toml`, applying a profile, or diagnosing different behavior
across ChromeOS/Linux, macOS, and Windows. It does not modify `config.toml`,
`window-state.json`, the shell, or multiplexer sessions.

## Verification

Use this procedure after installation, after changing a font setting, or when
comparing platforms:

1. Start fpasoterm and open the window menu.
2. Select **Font / Glyph Test**.
3. Confirm that the `CJK:` line reads:

   ```text
   CJK: 日本語 漢字 ひらがな カタカナ 中文 한국어
   ```

4. Confirm that the Japanese, Chinese, and Korean text has visible glyphs and
   consistent cell spacing. A tofu box, blank cell, or visibly different
   fallback font identifies a missing glyph in the configured font stack.
5. Check the `Half-width kana:`, `Box drawing:`, `Symbols:`, and `Nerd Font:`
   lines as needed.

`npm test` also asserts that this exact CJK sample is present in the renderer
source. The automated test cannot determine whether a host operating system
has the required fonts, so the panel remains the visual acceptance test.
