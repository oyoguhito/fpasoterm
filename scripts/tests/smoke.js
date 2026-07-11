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
assert.equal(packageJson.version, '0.0.5');
assert.equal(packageJson.main, 'src/main.js');
assert.equal(packageJson.bin.fpasoterm, 'bin/fpasoterm');
assert.equal(packageJson.license, 'MIT');
assert.equal(packageJson.repository.url, 'git+https://github.com/oyoguhito/fpasoterm.git');
assert.ok(packageJson.dependencies['smol-toml'], 'smol-toml should parse config.toml');
assert.ok(packageJson.dependencies.typescript, 'typescript should be available for .ts plugins');
assert.equal(packageJson.scripts.start, 'node ./bin/fpasoterm');
assert.equal(packageJson.scripts['generate:icons'], 'node scripts/generate-icon.js');
assert.equal(packageJson.scripts['install:desktop'], 'node scripts/install-linux-desktop.js');
assert.equal(packageJson.scripts['update:desktop'], 'node scripts/install-linux-desktop.js');
assert.equal(packageJson.scripts['uninstall:desktop'], 'node scripts/uninstall-linux-desktop.js');
assertFile('bin/fpasoterm');
assertFile('LICENSE');
assertFile('CHANGELOG.md');
assertFile('CONTRIBUTING.md');
assertFile('INSTALL.md');
assertFile('docs/config.en.md');
assertFile('docs/config.ja.md');
assertFile('docs/fpasoterm-plugin.d.ts');
assertFile('docs/known-issues.en.md');
assertFile('docs/known-issues.ja.md');
assertFile('examples/plugins/hello.ts');
assertFile('examples/plugins/theme.ts');
assertFile('examples/config/minimal.toml');
assertFile('examples/config/with-plugins.toml');
assertFile('extra/logo/fpasoterm.png');
assertFile('extra/macos/fpasoterm.icns');
assertFile('extra/windows/fpasoterm.ico');
for (const size of [16, 32, 48, 64, 128, 192, 256, 512]) {
  assertFile(`extra/linux/icons/hicolor/${size}x${size}/apps/fpasoterm.png`);
}
assertFile('scripts/install-linux-desktop.js');
assertFile('scripts/uninstall-linux-desktop.js');
assertFile('scripts/security/scan-secrets.js');

for (const file of [
  'src/main.js',
  'src/config.js',
  'src/preload.js',
  'src/renderer/index.html',
  'src/renderer/renderer.js',
  'src/renderer/styles.css',
  'extra/linux/io.github.oyoguhito.fpasoterm.desktop',
  'docs/spec.en.md',
  'docs/spec.ja.md',
  'docs/release-checklist.en.md',
  'docs/release-checklist.ja.md',
]) {
  assertFile(file);
}

const main = read('src/main.js');
assert.match(main, /FPASOTERM_DEBUG_KEYS/);
assert.match(main, /loadConfig/);
assert.match(main, /profileDir/);
assert.match(main, /config:get/);
assert.match(main, /setPath\('userData', profileDir\(\)\)/);
assert.match(main, /APP_NAME = 'fpasoterm'/);
assert.match(main, /APP_ID = 'io\.github\.oyoguhito\.fpasoterm'/);
assert.match(main, /FPASOTERM_CONSOLE_DIAGNOSTICS/);
assert.match(main, /FPASOTERM_WINDOW_WIDTH/);
assert.match(main, /FPASOTERM_WINDOW_HEIGHT/);
assert.match(main, /applyRuntimeOverrides/);
assert.match(main, /Menu\.setApplicationMenu\(null\)/);
assert.match(main, /runtimeConfig\.config\.window/);
assert.match(main, /width: windowConfig\.width/);
assert.match(main, /height: windowConfig\.height/);
assert.match(main, /minHeight: windowConfig\.minHeight/);
assert.match(main, /frame: windowConfig\.frame === false \? false : true/);
assert.match(main, /restoreWindowBounds/);
assert.match(main, /window\.setBounds\(bounds, false\)/);
assert.match(main, /applied window bounds/);
assert.match(main, /installWindowBoundsRestore/);
assert.match(main, /show: false/);
assert.match(main, /ready-to-show/);
assert.match(main, /did-finish-load/);
assert.match(main, /saving window bounds/);
assert.match(main, /restoring window bounds/);
assert.match(main, /installWindowStatePersistence/);
assert.match(main, /readyToSave = true/);
assert.match(main, /}, 1000\)/);
assert.match(main, /center: false/);
assert.match(main, /for \(const eventName of \['move', 'moved', 'resize', 'resized'\]\)/);
assert.match(main, /lastSavedBounds = saveWindowState\(window\)/);
assert.match(main, /ozone-platform/);
assert.match(main, /extra', 'logo', 'fpasoterm\.png/);
assert.match(main, /app\.dock\.setIcon\(ICON_PATH\)/);
assert.match(main, /extra', 'windows', 'fpasoterm\.ico/);
assert.match(main, /icon: ICON_PATH/);
assert.match(main, /BrowserWindow\.fromWebContents\(webContents\)/);
assert.match(main, /window\.close\(\)/);
assert.match(main, /window:close/);
assert.doesNotMatch(main, /ibus/i);

const bin = read('bin/fpasoterm');
assert.match(bin, /--ozone-platform=/);
assert.match(bin, /FPASOTERM_OZONE_PLATFORM/);
assert.match(bin, /--help/);
assert.match(bin, /--foreground/);
assert.match(bin, /--config/);
assert.match(bin, /--show-config/);
assert.match(bin, /--command/);
assert.match(bin, /--reset-window-state/);
assert.match(bin, /--enable-plugin/);
assert.match(bin, /--disable-plugin/);
assert.match(bin, /--size/);
assert.match(bin, /--console-diagnostics/);
assert.doesNotMatch(bin, /--position/);
assert.doesNotMatch(bin, /--x/);
assert.doesNotMatch(bin, /--y/);
assert.match(bin, /detached: !options\.foreground/);
assert.match(bin, /child\.unref\(\)/);
assert.match(bin, /printPluginList/);
assert.match(bin, /updatePluginConfig/);
assert.match(bin, /parsePluginSelectors/);
assert.match(bin, /discoverPluginFiles/);
assert.match(bin, /resolvePluginSelector/);

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
assert.equal(
  resolvePluginSelector('nested/hello.ts', discoveredPlugins, 'enable'),
  'plugins/nested/hello.ts',
);
fs.rmSync(cliTestDir, { recursive: true, force: true });

const originalConfigHome = process.env.XDG_CONFIG_HOME;
const originalConfigPath = process.env.FPASOTERM_CONFIG_PATH;
const stateTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fpasoterm-window-state-'));
process.env.XDG_CONFIG_HOME = stateTestDir;
delete process.env.FPASOTERM_CONFIG_PATH;
fs.mkdirSync(path.join(stateTestDir, 'fpasoterm', 'User'), { recursive: true });
const stateConfigPath = path.join(stateTestDir, 'fpasoterm', 'User', 'config.toml');
const statePath = path.join(stateTestDir, 'fpasoterm', 'User', 'window-state.json');
fs.writeFileSync(stateConfigPath, [
  '[window]',
  'width = 777',
  'x = 12',
  '',
].join('\n'));
fs.writeFileSync(path.join(stateTestDir, 'fpasoterm', 'User', 'config.toml.example'), 'old example\n');
writeWindowState({
  window: {
    x: 400,
    y: 300,
    width: 1200,
    height: 900,
  },
});
const stateConfig = loadConfig();
const generatedExample = fs.readFileSync(path.join(stateTestDir, 'fpasoterm', 'User', 'config.toml.example'), 'utf8');
assert.match(generatedExample, /# fpasoterm user configuration/);
assert.match(generatedExample, /rememberBounds = true/);
assert.equal(windowStatePath(), path.join(stateTestDir, 'fpasoterm', 'User', 'window-state.json'));
assert.equal(stateConfig.config.window.width, 1200);
assert.equal(stateConfig.config.window.x, 400);
assert.equal(stateConfig.config.window.height, 900);
assert.equal(stateConfig.config.window.y, 300);
const future = new Date(Date.now() + 60_000);
fs.utimesSync(stateConfigPath, future, future);
const updatedConfig = loadConfig();
assert.equal(updatedConfig.config.window.width, 1200);
assert.equal(updatedConfig.config.window.x, 400);
assert.equal(updatedConfig.config.window.height, 900);
assert.equal(updatedConfig.config.window.y, 300);
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
assert.match(runScript, /--foreground/);

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

const preload = read('src/preload.js');
assert.match(preload, /contextBridge\.exposeInMainWorld\('fpasoterm'/);
assert.match(preload, /getConfig/);
assert.match(preload, /closeWindow/);

const indexHtml = read('src/renderer/index.html');
assert.match(indexHtml, /id="drag-region"/);
assert.match(indexHtml, />fpasoterm</);
assert.match(indexHtml, /id="close-window"/);
assert.match(indexHtml, /id="terminal"/);

const readme = read('README.md');
assert.match(readme, /!\[fpasoterm logo\]\(extra\/logo\/fpasoterm\.png\)/);
assert.match(readme, /~\/\.config\/fpasoterm\/User\/config\.toml/);
assert.match(readme, /plugins\/.*\.ts/);
assert.match(readme, /docs\/config\.en\.md/);
assert.match(readme, /examples\/plugins/);
assert.match(readme, /--command/);
assert.match(readme, /--reset-window-state/);
assert.match(readme, /window-state\.json/);
assert.match(readme, /known-issues\.en\.md/);

const configDocsEn = read('docs/config.en.md');
assert.match(configDocsEn, /\[window\]/);
assert.match(configDocsEn, /width = 1000/);
assert.match(configDocsEn, /height = 680/);
assert.match(configDocsEn, /rememberBounds = true/);
assert.match(configDocsEn, /frame = false/);
assert.match(configDocsEn, /fontSize = 14/);
assert.match(configDocsEn, /duplicateWindowMs = 800/);
assert.match(configDocsEn, /window-state\.json/);
assert.match(configDocsEn, /same table to be defined more than once/);
assert.match(configDocsEn, /--command/);
assert.match(configDocsEn, /--reset-window-state/);

const configDocsJa = read('docs/config.ja.md');
assert.match(configDocsJa, /全デフォルト/);
assert.match(configDocsJa, /\[window\]/);
assert.match(configDocsJa, /examples\/plugins/);
assert.match(configDocsJa, /rememberBounds = true/);
assert.match(configDocsJa, /frame = false/);
assert.match(configDocsJa, /window-state\.json/);
assert.match(configDocsJa, /同じ table を複数回定義できません/);
assert.match(configDocsJa, /--command/);
assert.match(configDocsJa, /--reset-window-state/);

const knownIssuesEn = read('docs/known-issues.en.md');
assert.match(knownIssuesEn, /ChromeOS\/Baguette Window Position/);
assert.match(knownIssuesEn, /restores window size only/);
assert.match(knownIssuesEn, /GTK\/VTE frontend/);

const knownIssuesJa = read('docs/known-issues.ja.md');
assert.match(knownIssuesJa, /ChromeOS\/Baguette のウィンドウ位置/);
assert.match(knownIssuesJa, /window size のみ復元/);
assert.match(knownIssuesJa, /GTK\/VTE frontend/);

const samplePlugin = read('examples/plugins/hello.ts');
assert.match(samplePlugin, /fpasotermPluginApi/);

const sampleConfig = read('examples/config/with-plugins.toml');
assert.match(sampleConfig, /\[plugins\]/);
assert.match(sampleConfig, /plugins\/hello\.ts/);

const pluginTypes = read('docs/fpasoterm-plugin.d.ts');
assert.match(pluginTypes, /fpasotermPluginApi/);
assert.match(pluginTypes, /duplicateWindowMs/);

const renderer = read('src/renderer/renderer.js');
assert.match(renderer, /correctCompositionData/);
assert.match(renderer, /installCompositionDuplicateGuard/);
assert.match(renderer, /compositionupdate/);
assert.match(renderer, /repeatedTextWindowMs/);
assert.match(renderer, /fpasotermPluginApi/);
assert.match(renderer, /closeWindowButton/);
assert.match(renderer, /closeWindow\(\)/);
assert.match(renderer, /applyWindowAppearance/);
assert.match(renderer, /frameless-window/);

const styles = read('src/renderer/styles.css');
assert.match(styles, /#drag-region/);
assert.match(styles, /background: #1565c0/);
assert.match(styles, /-webkit-app-region: drag/);
assert.match(styles, /app-region: drag/);
assert.match(styles, /height: 34px/);
assert.match(styles, /pointer-events: none/);
assert.match(styles, /#close-window/);
assert.match(styles, /app-region: no-drag/);
assert.match(styles, /padding: 0/);
assert.match(styles, /background: transparent/);
assert.match(styles, /width: 100%/);
assert.match(styles, /\.xterm-screen canvas/);

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
assert.match(config, /# Window options/);
assert.match(config, /# Plugins are relative/);
assert.match(config, /window:/);
assert.match(config, /width: 1000/);
assert.match(config, /height: 680/);
assert.match(config, /minHeight: 260/);
assert.match(config, /rememberBounds: true/);
assert.match(config, /frame: false/);
assert.match(config, /themeSource: 'system'/);
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

  const runtimeNamePattern = new RegExp(`${'elect'}${'ron'}`, 'i');
  assert.doesNotMatch(read(file), runtimeNamePattern, `${file} should not mention a replaceable desktop runtime`);
}

console.log('smoke checks passed');
