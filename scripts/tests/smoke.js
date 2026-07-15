const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const toml = require('smol-toml');
const {
  deleteWindowState,
  discoverPluginFiles,
  loadConfig,
  resolvePluginSelector,
  windowStatePath,
  writeWindowState,
} = require('../../src/config');

const root = path.resolve(__dirname, '..', '..');

// Reads a repository file as UTF-8 for assertions.
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

// Asserts that a required source, doc, or asset file is present.
function assertFile(relativePath) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} should exist`);
}

const packageJson = JSON.parse(read('package.json'));

assert.equal(packageJson.name, 'fpasoterm');
assert.equal(packageJson.version, '1.0.2');
assert.equal(packageJson.bin.fpasoterm, 'bin/fpasoterm');
assert.equal(packageJson.license, 'MIT');
assert.equal(packageJson.repository.url, 'git+https://github.com/oyoguhito/fpasoterm.git');
assert.ok(packageJson.dependencies['@tauri-apps/api'], '@tauri-apps/api should expose Tauri APIs');
assert.ok(packageJson.dependencies['@tauri-apps/cli'], '@tauri-apps/cli should launch and build the app');
assert.ok(packageJson.dependencies['smol-toml'], 'smol-toml should parse config.toml');
assert.ok(packageJson.dependencies.typescript, 'typescript should be available for .ts plugins');
assert.equal(packageJson.scripts.start, 'node ./bin/fpasoterm');
assert.equal(packageJson.scripts.build, 'tauri build');
assert.match(packageJson.scripts.check, /cargo check --manifest-path src-tauri\/Cargo\.toml/);
const oldRuntimePackage = `${'elect'}${'ron'}`;
const oldPtyPackage = `${'node'}-${'pty'}`;
assert.equal(Object.hasOwn(packageJson.dependencies, oldRuntimePackage), false);
assert.equal(Object.hasOwn(packageJson.dependencies, oldPtyPackage), false);
assert.equal(Object.hasOwn(packageJson, 'allowScripts'), false);

for (const file of [
  'bin/fpasoterm',
  'LICENSE',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'INSTALL.md',
  'docs/config.en.md',
  'docs/config.ja.md',
  'docs/fpasoterm-plugin.d.ts',
  'docs/known-issues.en.md',
  'docs/known-issues.ja.md',
  'docs/spec.en.md',
  'docs/spec.ja.md',
  'examples/plugins/hello.ts',
  'examples/plugins/theme.ts',
  'examples/config/minimal.toml',
  'examples/config/with-plugins.toml',
  'extra/logo/fpasoterm.png',
  'extra/macos/fpasoterm.icns',
  'extra/windows/fpasoterm.ico',
  'scripts/install-linux-desktop.js',
  'scripts/uninstall-linux-desktop.js',
  'scripts/security/scan-secrets.js',
  'src/config.js',
  'src/renderer/index.html',
  'src/renderer/renderer.js',
  'src/renderer/styles.css',
  'src/renderer/vendor/xterm/xterm.css',
  'src/renderer/vendor/xterm/xterm.js',
  'src/renderer/vendor/addon-fit/addon-fit.js',
  'src-tauri/Cargo.toml',
  'src-tauri/capabilities/default.json',
  'src-tauri/tauri.conf.json',
  'src-tauri/src/main.rs',
  'extra/linux/io.github.oyoguhito.fpasoterm.desktop',
  '.github/workflows/release.yml',
]) {
  assertFile(file);
}

assert.ok(!fs.existsSync(path.join(root, 'src', 'main.js')), 'old desktop process file should be removed');
assert.ok(!fs.existsSync(path.join(root, 'src', 'preload.js')), 'old bridge file should be removed');

for (const size of [16, 32, 48, 64, 128, 192, 256, 512]) {
  assertFile(`extra/linux/icons/hicolor/${size}x${size}/apps/fpasoterm.png`);
}

const bin = read('bin/fpasoterm');
assert.match(bin, /--help/);
assert.match(bin, /--dev/);
assert.match(bin, /--foreground/);
assert.match(bin, /--config/);
assert.match(bin, /--show-config/);
assert.match(bin, /--command/);
assert.match(bin, /--reset-window-state/);
assert.match(bin, /--enable-plugin/);
assert.match(bin, /--disable-plugin/);
assert.match(bin, /--size/);
assert.match(bin, /applyWindowRuntimeOverrides/);
assert.match(bin, /--console-diagnostics/);
assert.match(bin, /--debug-opaque-terminal/);
assert.match(bin, /--disable-dmabuf/);
assert.match(bin, /WEBKIT_DISABLE_DMABUF_RENDERER/);
assert.match(bin, /FPASOTERM_RUNTIME_CONFIG_JSON/);
assert.match(bin, /debugKeys/);
assert.match(bin, /consoleDiagnostics/);
assert.match(bin, /opaqueTerminal/);
assert.match(bin, /@tauri-apps/);
assert.match(bin, /detached: !options\.foreground/);
assert.match(bin, /child\.unref\(\)/);
assert.doesNotMatch(bin, new RegExp(`--${'ozo'}${'ne'}-platform`));
assert.doesNotMatch(bin, new RegExp(`FPASOTERM_${'OZONE'}_PLATFORM`));
assert.doesNotMatch(bin, new RegExp(`--disable-${'g'}${'pu'}`));
assert.doesNotMatch(bin, /--position/);
assert.doesNotMatch(bin, /FPASOTERM_WINDOW_X/);

// Exercises file-name selection, comma-separated values, and repeated options.
const cliTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fpasoterm-plugin-cli-'));
const cliConfigPath = path.join(cliTestDir, 'User', 'config.toml');
const cliPluginsDir = path.join(cliTestDir, 'User', 'plugins');
fs.mkdirSync(cliPluginsDir, { recursive: true });
fs.writeFileSync(path.join(cliPluginsDir, 'hello.ts'), '// test plugin\n');
fs.writeFileSync(path.join(cliPluginsDir, 'theme.js'), '// test plugin\n');

const runCli = (...args) => spawnSync(
  process.execPath,
  [path.join(root, 'bin', 'fpasoterm'), '--config', cliConfigPath, ...args],
  { encoding: 'utf8' },
);

const enableResult = runCli('--enable-plugin', 'hello.ts, theme.js');
assert.equal(enableResult.status, 0, enableResult.stderr);
assert.deepEqual(toml.parse(fs.readFileSync(cliConfigPath, 'utf8')).plugins.enabled, [
  'plugins/hello.ts',
  'plugins/theme.js',
]);

const disableResult = runCli('--disable-plugin', 'hello.ts', '--disable-plugin', 'theme.js');
assert.equal(disableResult.status, 0, disableResult.stderr);
assert.deepEqual(toml.parse(fs.readFileSync(cliConfigPath, 'utf8')).plugins.enabled, []);

fs.mkdirSync(path.join(cliPluginsDir, 'nested'), { recursive: true });
fs.writeFileSync(path.join(cliPluginsDir, 'nested', 'hello.ts'), '// duplicate test plugin\n');
const discoveredPlugins = discoverPluginFiles(cliConfigPath);
assert.deepEqual(discoveredPlugins, [
  'plugins/hello.ts',
  'plugins/nested/hello.ts',
  'plugins/theme.js',
]);
assert.throws(
  () => resolvePluginSelector('hello.ts', discoveredPlugins, 'enable'),
  /plugin name 'hello\.ts' is ambiguous.*plugins\/nested\/hello\.ts/,
);
assert.equal(resolvePluginSelector('nested/hello.ts', discoveredPlugins, 'enable'), 'plugins/nested/hello.ts');
fs.rmSync(cliTestDir, { recursive: true, force: true });

const originalConfigHome = process.env.XDG_CONFIG_HOME;
const originalConfigPath = process.env.FPASOTERM_CONFIG_PATH;
const stateTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fpasoterm-window-state-'));
process.env.XDG_CONFIG_HOME = stateTestDir;
delete process.env.FPASOTERM_CONFIG_PATH;
fs.mkdirSync(path.join(stateTestDir, 'fpasoterm', 'User'), { recursive: true });
const statePath = path.join(stateTestDir, 'fpasoterm', 'User', 'window-state.json');
fs.writeFileSync(path.join(stateTestDir, 'fpasoterm', 'User', 'config.toml'), [
  '[window]',
  'width = 777',
  '',
].join('\n'));
fs.writeFileSync(path.join(stateTestDir, 'fpasoterm', 'User', 'config.toml.example'), 'old example\n');
writeWindowState({ window: { width: 1200, height: 900 } });
const stateConfig = loadConfig();
const generatedExample = fs.readFileSync(path.join(stateTestDir, 'fpasoterm', 'User', 'config.toml.example'), 'utf8');
assert.match(generatedExample, /# fpasoterm user configuration/);
assert.match(generatedExample, /rememberBounds = true/);
assert.equal(windowStatePath(), path.join(stateTestDir, 'fpasoterm', 'User', 'window-state.json'));
assert.equal(stateConfig.config.window.width, 1200);
assert.equal(stateConfig.config.window.height, 900);
deleteWindowState();
assert.ok(!fs.existsSync(statePath));
if (originalConfigHome === undefined) {
  delete process.env.XDG_CONFIG_HOME;
} else {
  process.env.XDG_CONFIG_HOME = originalConfigHome;
}
if (originalConfigPath === undefined) {
  delete process.env.FPASOTERM_CONFIG_PATH;
} else {
  process.env.FPASOTERM_CONFIG_PATH = originalConfigPath;
}
fs.rmSync(stateTestDir, { recursive: true, force: true });

const runScript = read('scripts/run');
assert.doesNotMatch(runScript, /--foreground/);

const buildArtifacts = read('scripts/build-artifacts.js');
assert.match(buildArtifacts, /--bundles', 'deb,rpm'/);
assert.match(buildArtifacts, /entry\.name\.includes\(version\)/);
assert.match(buildArtifacts, /--source-only/);
assert.match(buildArtifacts, /--bundles-only/);
assert.match(buildArtifacts, /FPASOTERM_ARTIFACT_LABEL/);
assert.match(buildArtifacts, /labelArtifactName/);
assert.match(buildArtifacts, /run\('npm', buildArgs\)/);
assert.match(buildArtifacts, /spawnSync/);
assert.match(buildArtifacts, /shell: process\.platform === 'win32'/);
assert.match(buildArtifacts, /\.dmg/);
assert.match(buildArtifacts, /\.msi/);
assert.match(buildArtifacts, /\.exe/);
assert.match(buildArtifacts, /\.app\.tar\.gz/);

const releaseWorkflow = read('.github/workflows/release.yml');
assert.match(releaseWorkflow, /ubuntu-24\.04-arm/);
assert.match(releaseWorkflow, /macos-15-intel/);
assert.match(releaseWorkflow, /macos-latest/);
assert.match(releaseWorkflow, /windows-latest/);
assert.match(releaseWorkflow, /FPASOTERM_ARTIFACT_LABEL/);
assert.match(releaseWorkflow, /actions\/checkout@v5/);
assert.match(releaseWorkflow, /actions\/setup-node@v5/);
assert.match(releaseWorkflow, /actions\/upload-artifact@v6/);
assert.match(releaseWorkflow, /gh run download "\$\{GITHUB_RUN_ID\}" --repo "\$\{GITHUB_REPOSITORY\}" --dir release-artifacts/);
assert.doesNotMatch(releaseWorkflow, /actions\/download-artifact@/);
assert.match(releaseWorkflow, /gh release upload/);
assert.match(releaseWorkflow, /--clobber/);
assert.match(releaseWorkflow, /Verify macOS bundles/);
assert.match(releaseWorkflow, /codesign --verify --deep --strict/);
assert.match(releaseWorkflow, /hdiutil verify/);
assert.doesNotMatch(releaseWorkflow, /ref: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.tag/);

const installDesktop = read('scripts/install-linux-desktop.js');
assert.match(installDesktop, /XDG_BIN_HOME/);
assert.match(installDesktop, /fpasoterm command/);
assert.match(installDesktop, /APP_ROOT=/);
assert.match(installDesktop, /io\.github\.oyoguhito\.FpasoTerm\.desktop/);

const uninstallDesktop = read('scripts/uninstall-linux-desktop.js');
assert.match(uninstallDesktop, /XDG_BIN_HOME/);
assert.match(uninstallDesktop, /removed:/);
assert.match(uninstallDesktop, /io\.github\.oyoguhito\.fpasoterm\.desktop/);
assert.match(uninstallDesktop, /io\.github\.oyoguhito\.FpasoTerm\.desktop/);
assert.match(uninstallDesktop, /fpasoterm\.png/);

const tauriConfig = read('src-tauri/tauri.conf.json');
assert.match(tauriConfig, /"withGlobalTauri": true/);
assert.match(tauriConfig, /"macOSPrivateApi": true/);
assert.match(tauriConfig, /"macOS": \{/);
assert.match(tauriConfig, /"signingIdentity": "-"/);
assert.match(tauriConfig, /"transparent": true/);
assert.match(tauriConfig, /"backgroundColor": "#00000000"/);
assert.match(tauriConfig, /"decorations": false/);

const cargoToml = read('src-tauri/Cargo.toml');
assert.match(cargoToml, /tauri =/);
assert.match(cargoToml, /macos-private-api/);
assert.match(cargoToml, /portable-pty/);

const tauriCapabilities = read('src-tauri/capabilities/default.json');
assert.match(tauriCapabilities, /core:event:allow-listen/);
assert.match(tauriCapabilities, /core:window:allow-start-resize-dragging/);
assert.match(tauriCapabilities, /"windows": \["main"\]/);

const rustMain = read('src-tauri/src/main.rs');
assert.match(rustMain, /portable_pty/);
assert.match(rustMain, /terminal_start/);
assert.match(rustMain, /terminal_write/);
assert.match(rustMain, /terminal_resize/);
assert.match(rustMain, /diagnostics:event/);
assert.match(rustMain, /terminal_write bytes/);
assert.match(rustMain, /macos_login_shell/);
assert.match(rustMain, /dscl/);
assert.match(rustMain, /UserShell/);
assert.match(rustMain, /window_save_bounds/);
assert.match(rustMain, /window_get_bounds/);
assert.match(rustMain, /window_set_bounds/);
assert.match(rustMain, /PhysicalPosition/);
assert.match(rustMain, /restoring window size/);
assert.match(rustMain, /PhysicalSize::new\(config\.config\.window\.width/);
assert.match(rustMain, /schedule_window_size_restore/);
assert.match(rustMain, /Duration::from_millis\(350\)/);
assert.match(rustMain, /WindowEvent::Resized\(size\)/);
assert.match(rustMain, /save_window_size\(\*size/);
assert.doesNotMatch(rustMain, /WindowEvent::Moved/);
assert.doesNotMatch(rustMain, /WindowEvent::Destroyed/);
assert.match(rustMain, /config_get/);
assert.match(rustMain, /WEBKIT_DISABLE_DMABUF_RENDERER/);
assert.match(rustMain, /FPASOTERM_RUNTIME_CONFIG_JSON/);

const indexHtml = read('src/renderer/index.html');
assert.match(indexHtml, /id="drag-region"/);
assert.match(indexHtml, />fpasoterm</);
assert.match(indexHtml, /id="close-window"/);
assert.match(indexHtml, /id="terminal"/);
assert.match(indexHtml, /id="terminal-mirror"/);
assert.match(indexHtml, /vendor\/xterm\/xterm\.js/);
assert.match(indexHtml, /vendor\/addon-fit\/addon-fit\.js/);

const readme = read('README.md');
assert.match(readme, /Tauri, xterm\.js, and a Rust PTY bridge/);
assert.match(readme, /~\/\.config\/fpasoterm\/User\/config\.toml/);
assert.match(readme, /plugins\/.*\.ts/);
assert.match(readme, /docs\/config\.en\.md/);
assert.match(readme, /examples\/plugins/);
assert.match(readme, /--command/);
assert.match(readme, /--reset-window-state/);
assert.match(readme, /--disable-dmabuf/);
assert.match(readme, /window-state\.json/);
assert.match(readme, /known-issues\.en\.md/);

const configDocsEn = read('docs/config.en.md');
assert.match(configDocsEn, /\[window\]/);
assert.match(configDocsEn, /width = 1000/);
assert.match(configDocsEn, /height = 680/);
assert.match(configDocsEn, /rememberBounds = true/);
assert.match(configDocsEn, /frame = false/);
assert.match(configDocsEn, /allowTransparency = true/);
assert.match(configDocsEn, /fontSize = 14/);
assert.match(configDocsEn, /duplicateWindowMs = 800/);
assert.match(configDocsEn, /window-state\.json/);
assert.match(configDocsEn, /same table to be defined more than once/);

const configDocsJa = read('docs/config.ja.md');
assert.match(configDocsJa, /全デフォルト/);
assert.match(configDocsJa, /\[window\]/);
assert.match(configDocsJa, /examples\/plugins/);
assert.match(configDocsJa, /rememberBounds = true/);
assert.match(configDocsJa, /frame = false/);
assert.match(configDocsJa, /allowTransparency = true/);
assert.match(configDocsJa, /window-state\.json/);
assert.match(configDocsJa, /同じ table を複数回定義できません/);

const knownIssuesEn = read('docs/known-issues.en.md');
assert.match(knownIssuesEn, /ChromeOS\/Baguette Window Position/);
assert.match(knownIssuesEn, /restores window size only/);
assert.match(knownIssuesEn, /future task/);
assert.match(knownIssuesEn, /WEBKIT_DISABLE_DMABUF_RENDERER=1/);

const knownIssuesJa = read('docs/known-issues.ja.md');
assert.match(knownIssuesJa, /ChromeOS\/Baguette のウィンドウ位置/);
assert.match(knownIssuesJa, /window size のみ復元/);
assert.match(knownIssuesJa, /今後の課題/);
assert.match(knownIssuesJa, /WEBKIT_DISABLE_DMABUF_RENDERER=1/);

const samplePlugin = read('examples/plugins/hello.ts');
assert.match(samplePlugin, /fpasotermPluginApi/);

const sampleConfig = read('examples/config/with-plugins.toml');
assert.match(sampleConfig, /\[plugins\]/);
assert.match(sampleConfig, /plugins\/hello\.ts/);

const pluginTypes = read('docs/fpasoterm-plugin.d.ts');
assert.match(pluginTypes, /fpasotermPluginApi/);
assert.match(pluginTypes, /duplicateWindowMs/);

const renderer = read('src/renderer/renderer.js');
assert.match(renderer, /installTauriApiAdapter/);
assert.match(renderer, /__TAURI__/);
assert.match(renderer, /startWindowDrag/);
assert.match(renderer, /startWindowResizeDrag/);
assert.match(renderer, /startResizeDragging/);
assert.match(renderer, /saveWindowBounds/);
assert.match(renderer, /getWindowBounds/);
assert.match(renderer, /setWindowBounds/);
assert.match(renderer, /scheduleWindowStateSave/);
assert.match(renderer, /scheduleFitAndResize/);
assert.match(renderer, /afterNextPaint/);
assert.match(renderer, /removeXtermVisualOverlays/);
assert.match(renderer, /installXtermOverlayPruner/);
assert.match(renderer, /logXtermCanvasDiagnostics/);
assert.match(renderer, /logXtermTextDiagnostics/);
assert.match(renderer, /repeated-w/);
assert.match(renderer, /MutationObserver/);
assert.match(renderer, /screenReaderMode: false/);
assert.match(renderer, /startManualWindowResize/);
assert.match(renderer, /manual window resize failed/);
assert.match(renderer, /toTauriResizeDirection/);
assert.match(renderer, /renderer terminal data bytes/);
assert.match(renderer, /renderer terminal write parsed bytes/);
assert.match(renderer, /mirrorTerminalData/);
assert.match(renderer, /terminal write failed/);
assert.doesNotMatch(renderer, /setPointerCapture/);
assert.match(renderer, /correctCompositionData/);
assert.match(renderer, /installCompositionDuplicateGuard/);
assert.match(renderer, /compositionupdate/);
assert.match(renderer, /repeatedTextWindowMs/);
assert.match(renderer, /fpasotermPluginApi/);
assert.match(renderer, /closeWindowButton/);
assert.match(renderer, /closeWindow\(\)/);
assert.match(renderer, /applyWindowAppearance/);

const styles = read('src/renderer/styles.css');
assert.match(styles, /#drag-region/);
assert.match(styles, /background: #1565c0/);
assert.match(styles, /-webkit-app-region: drag/);
assert.match(styles, /app-region: drag/);
assert.match(styles, /--titlebar-height: 34px/);
assert.match(styles, /grid-template-rows: var\(--titlebar-height\) minmax\(0, 1fr\)/);
assert.match(styles, /height: var\(--titlebar-height\)/);
assert.match(styles, /pointer-events: none/);
assert.match(styles, /#close-window/);
assert.match(styles, /resize-edge/);
assert.match(styles, /resize-corner/);
assert.match(styles, /rgba\(0, 0, 0, 0\.001\)/);
assert.match(styles, /app-region: no-drag/);
assert.match(styles, /padding: 0/);
assert.match(styles, /background: transparent/);
assert.match(styles, /width: 100%/);
assert.match(styles, /xterm-accessibility/);
assert.match(styles, /display: none !important/);
assert.match(styles, /visibility: hidden !important/);
assert.match(styles, /xterm-helper-textarea/);
assert.match(styles, /xterm-char-measure-element/);
assert.match(styles, /left: -9999em !important/);
assert.match(styles, /-webkit-text-fill-color: transparent !important/);
assert.doesNotMatch(styles, /\.xterm-screen,\s*\.xterm-screen canvas\s*\{[^}]*height: 100% !important/s);
assert.doesNotMatch(styles, /\.xterm-screen canvas\s*\{[^}]*display: block/s);

const config = read('src/config.js');
assert.match(config, /defaultConfig/);
assert.match(config, /defaultConfigExample/);
assert.match(config, /writeDefaultConfigExample/);
assert.match(config, /profileDir/);
assert.match(config, /'User'/);
assert.match(config, /smol-toml/);
assert.match(config, /config\.toml/);
assert.match(config, /FPASOTERM_CONFIG_PATH/);
assert.match(config, /readUserConfig/);
assert.match(config, /writeUserConfig/);
assert.match(config, /windowStatePath/);
assert.match(config, /readWindowState/);
assert.match(config, /\.example/);
assert.match(config, /typescript/);
assert.match(config, /\.ts/);
assert.match(config, /transpileModule/);

const desktop = read('extra/linux/io.github.oyoguhito.fpasoterm.desktop');
assert.match(desktop, /^Name=fpasoterm$/m);
assert.match(desktop, /^Icon=fpasoterm$/m);
assert.match(desktop, /^StartupWMClass=io\.github\.oyoguhito\.fpasoterm$/m);

for (const file of [
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'INSTALL.md',
  'docs/spec.en.md',
  'docs/spec.ja.md',
  'docs/release-checklist.en.md',
  'docs/release-checklist.ja.md',
]) {
  const externalEditorPattern = new RegExp(`${'vs'}\\s*${'code'}|${'vs'}${'code'}`, 'i');
  assert.doesNotMatch(read(file), externalEditorPattern, `${file} should not mention external editor wording`);
}

console.log('smoke checks passed');
