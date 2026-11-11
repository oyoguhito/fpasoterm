# Third-party notices

This notice accompanies fpasoterm's npm package, portable source archive, and
native application bundles. The exact Rust and npm dependency inventories are
respectively [`src-tauri/Cargo.lock`](src-tauri/Cargo.lock) and
[`package-lock.json`](package-lock.json).

## Bundled xterm.js assets

The renderer ships the following unmodified xterm.js distributions under the
MIT license. Their complete upstream copyright and license text is kept beside
the copied asset and is therefore included in both the npm package and the
Tauri frontend:

| Package | Bundled version | Asset and license |
| --- | --- | --- |
| `@xterm/xterm` | `6.1.0-beta.288` | `src/renderer/vendor/xterm/` |
| `@xterm/addon-fit` | `0.12.0-beta.288` | `src/renderer/vendor/addon-fit/` |
| `@xterm/addon-web-links` | `0.12.0` | `src/renderer/vendor/addon-web-links/` |
| `@xterm/addon-image` | `0.10.0-beta.288` | `src/renderer/vendor/addon-image/` |

Source: <https://github.com/xtermjs/xterm.js>. The fpasoterm-specific code
does not alter these vendor files.

## Rust application dependencies

The Tauri application resolves its exact crate set from `src-tauri/Cargo.lock`.
The currently resolved set includes five MPL-2.0 crates:

- `cssparser` 0.36.0 and `cssparser-macros` 0.6.1
- `dtoa-short` 0.3.5
- `option-ext` 0.2.0
- `selectors` 0.36.1

Their source code and the complete MPL-2.0 text can be obtained without charge
from their versioned crate pages:

- <https://crates.io/crates/cssparser/0.36.0>
- <https://crates.io/crates/cssparser-macros/0.6.1>
- <https://crates.io/crates/dtoa-short/0.3.5>
- <https://crates.io/crates/option-ext/0.2.0>
- <https://crates.io/crates/selectors/0.36.1>
- <https://www.mozilla.org/MPL/2.0/>

To reproduce the whole resolved Rust source set from this checkout, run
`cargo vendor --locked third_party_source --manifest-path src-tauri/Cargo.toml`.
Other resolved Rust and npm packages are under permissive licenses recorded in
their lockfiles. `r-efi` is available under MIT or Apache-2.0 and is used under
one of those options, not its LGPL alternative.

Platform installers may also rely on operating-system components such as the
system WebView, GTK/WebKit, and platform graphics libraries. Those components
are not copied into the npm package; their licenses are supplied by their
respective platform distributions.
