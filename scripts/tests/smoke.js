const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const toml = require('smol-toml');
const {
  deleteWindowState,
  defaultConfigExample,
  discoverPluginFiles,
  loadConfig,
  mergeConfig,
  missingConfigKeys,
  platformDefaultConfig,
  pruneUnsupportedConfig,
  resolvePluginSelector,
  writableConfigDefaults,
  windowStatePath,
  writeWindowState,
} = require('../../src/config');

assert.equal(platformDefaultConfig('darwin', 'x64').terminal.fontSize, 12);
assert.equal(platformDefaultConfig('darwin', 'arm64').terminal.fontSize, 14);
assert.equal(platformDefaultConfig('win32', 'x64').terminal.fontSize, 14);
assert.match(platformDefaultConfig('darwin', 'arm64').terminal.fontFamily, /^"SF Mono", Menlo/);
assert.match(platformDefaultConfig('win32', 'x64').terminal.fontFamily, /^"Noto Sans Mono CJK JP"/);
assert.match(defaultConfigExample('darwin', 'x64'), /fontSize = 12/);
assert.match(defaultConfigExample('darwin', 'arm64'), /fontSize = 14/);
assert.match(defaultConfigExample('darwin', 'arm64'), /fontFamily = "\\"SF Mono\\", Menlo/);
const missingDefaults = missingConfigKeys(writableConfigDefaults(), { keybindings: { prefix: 'Ctrl+Alt' } });
assert.ok(missingDefaults.includes('keybindings.newWindow'));
assert.equal(missingDefaults.includes('terminal.images.enabled'), false);
assert.equal(missingDefaults.includes('keybindings.prefix'), false);
assert.deepEqual(
  pruneUnsupportedConfig(writableConfigDefaults(), {
    window: { title: 'test', oldSetting: true },
    retiredSection: { enabled: true },
  }),
  { config: { window: { title: 'test' } }, removed: ['window.oldSetting', 'retiredSection'] },
);

const root = path.resolve(__dirname, '..', '..');
const removedSnakeHttpUiPattern = new RegExp(['web', 'console'].join('_'));
const removedKebabHttpUiPattern = new RegExp(['web', 'console'].join('-'));
const removedCamelHttpUiPattern = new RegExp(['web', 'Console'].join(''));
const removedTemporaryHttpUiPattern = new RegExp(['temporary', 'web', 'console'].join(' '));
const removedTemporaryHttpUiDocPattern = new RegExp(['temporary', 'web', 'console'].join('-'));
const removedHttpUiEnvPattern = new RegExp(['FPASOTERM', 'WEB', 'CONSOLE'].join('_'));

// Reads a repository file as UTF-8 for assertions.
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

// Asserts that a required source, doc, or asset file is present.
function assertFile(relativePath) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} should exist`);
}

const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));

assert.equal(packageJson.name, 'fpasoterm');
assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
assert.equal(packageLock.version, packageJson.version);
assert.equal(packageLock.packages[''].version, packageJson.version);
assert.equal(packageJson.bin.fpasoterm, 'bin/fpasoterm');
assert.equal(packageJson.license, 'MIT');
assert.equal(packageJson.repository.url, 'git+https://github.com/oyoguhito/fpasoterm.git');
assert.ok(packageJson.dependencies['@tauri-apps/api'], '@tauri-apps/api should expose Tauri APIs');
assert.ok(packageJson.dependencies['@tauri-apps/cli'], '@tauri-apps/cli should launch and build the app');
assert.ok(packageJson.dependencies['smol-toml'], 'smol-toml should parse config.toml');
assert.ok(packageJson.dependencies['@xterm/addon-image'], '@xterm/addon-image should render Kitty graphics');
assert.ok(packageJson.dependencies.typescript, 'typescript should be available for .ts plugins');
assert.equal(packageJson.scripts.start, 'node ./bin/fpasoterm');
assert.equal(packageJson.scripts.build, 'tauri build');
assert.match(packageJson.scripts.check, /cargo check --manifest-path src-tauri\/Cargo\.toml/);
assert.equal(packageJson.scripts['uninstall:desktop'], 'node scripts/uninstall-desktop.js');
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
  'INSTALL.ja.md',
  'README.ja.md',
  'docs/config.en.md',
  'docs/config.ja.md',
  'docs/fpasoterm-plugin.d.ts',
  'docs/known-issues.en.md',
  'docs/known-issues.ja.md',
  'docs/pr-review.en.md',
  'docs/pr-review.ja.md',
  'docs/spec.en.md',
  'docs/spec.ja.md',
  'docs/sync.en.md',
  'docs/sync.ja.md',
  'examples/apply-default-appearance.sh',
  'examples/apply-default-appearance.ps1',
  'examples/apply-default-appearance.bat',
  'examples/apply-runtime-appearance.sh',
  'examples/apply-runtime-appearance.ps1',
  'examples/apply-runtime-appearance.bat',
  'examples/plugins/hello.ts',
  'examples/plugins/theme.ts',
  'examples/config/default-appearance.toml',
  'examples/config/minimal.toml',
  'examples/config/runtime-appearance.toml',
  'examples/config/sync-folder.toml',
  'examples/config/with-plugins.toml',
  'extra/logo/fpasoterm.png',
  'extra/macos/fpasoterm.icns',
  'extra/windows/fpasoterm.ico',
  'scripts/install-linux-desktop.js',
  'scripts/uninstall-desktop.js',
  'scripts/uninstall-linux-desktop.js',
  'scripts/uninstall-windows-path.js',
  'scripts/security/scan-secrets.js',
  'src/config.js',
  'src/renderer/index.html',
  'src/renderer/renderer.js',
  'src/renderer/styles.css',
  'src/renderer/vendor/xterm/xterm.css',
  'src/renderer/vendor/xterm/xterm.js',
  'src/renderer/vendor/addon-fit/addon-fit.js',
  'src/renderer/vendor/addon-image/addon-image.js',
  'src/renderer/vendor/addon-image/LICENSE',
  'src-tauri/Cargo.toml',
  'src-tauri/build.rs',
  'src-tauri/default-config.toml',
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
assert.match(bin, /--version/);
assert.match(bin, /-v, --version/);
assert.match(bin, /-l, --list/);
assert.match(bin, /-q, --close <pid\|title\|all>/);
assert.match(bin, /printRunningInstances/);
assert.match(bin, /closeRunningInstance/);
assert.match(bin, /--dev/);
assert.match(bin, /--foreground/);
assert.match(bin, /--config/);
assert.match(bin, /--show-config/);
assert.match(bin, /--update-config/);
assert.match(bin, /--prune-config/);
assert.match(bin, /--self-update/);
assert.match(bin, /--self-update-checkout/);
assert.match(bin, /--update-desktop/);
assert.match(bin, /--shell/);
assert.match(bin, /--command/);
assert.match(bin, /--title/);
assert.match(bin, /--titlebar-color/);
assert.match(bin, /--reset-window-state/);
assert.match(bin, /-R, --reset-config/);
assert.match(bin, /--enable-plugin/);
assert.match(bin, /--disable-plugin/);
assert.match(bin, /--size/);
assert.match(bin, /-t, --title/);
assert.match(bin, /-b, --titlebar-color/);
assert.match(bin, /FPASOTERM_WINDOW_TITLE/);
assert.match(bin, /FPASOTERM_TITLEBAR_COLOR/);
assert.match(bin, /applyWindowRuntimeOverrides/);
assert.match(bin, /applyTerminalRuntimeOverrides/);
assert.match(bin, /--console-diagnostics/);
assert.match(bin, /--debug-opaque-terminal/);
assert.match(bin, /--disable-dmabuf/);
assert.match(bin, /WEBKIT_DISABLE_DMABUF_RENDERER/);
assert.match(bin, /FPASOTERM_RUNTIME_CONFIG_JSON/);
assert.match(bin, /FPASOTERM_LAUNCHER_LOG/);
assert.match(bin, /appendLauncherLog/);
assert.match(bin, /npmCommand/);
assert.match(bin, /runChecked/);
assert.match(bin, /isSourceCheckout/);
assert.match(bin, /isJjCheckout/);
assert.match(bin, /ensureCleanGitCheckout/);
assert.match(bin, /updateDesktopIntegration/);
assert.match(bin, /selfUpdate/);
assert.match(bin, /selfUpdateCheckout/);
assert.match(bin, /npmCommand\(\), \['install', '-g', 'fpasoterm@latest'\]/);
assert.match(bin, /git', \['pull', '--ff-only'\]/);
assert.match(bin, /npmCommand\(\), \['install'\]/);
assert.match(bin, /debugKeys/);
assert.match(bin, /consoleDiagnostics/);
assert.match(bin, /opaqueTerminal/);
assert.doesNotMatch(bin, /node_modules.*@tauri-apps.*tauri\.js/);
assert.match(bin, /detached: !options\.foreground/);
assert.match(bin, /child\.unref\(\)/);
assert.match(bin, /windowsHide: !options\.foreground/);
assert.match(bin, /isBuiltBinaryCurrent/);
assert.match(bin, /latestRuntimeSourceMtime/);
assert.match(bin, /buildTauriBinary/);
assert.match(bin, /buildStampPath/);
assert.match(bin, /readBuildStamp/);
assert.match(bin, /writeBuildStamp/);
assert.match(bin, /findStampedTauriBinary/);
assert.match(bin, /FPASOTERM_X11/);
assert.match(bin, /launcher build=skip current binary/);
assert.match(bin, /\.fpasoterm-normal-build\.json/);
assert.match(bin, /cargo', \['build', '--manifest-path'/);
assert.match(bin, /launcher mode=\$\{options\.dev \? 'debug-binary' : 'binary'\}/);
assert.match(bin, /const tauriBinary = await buildTauriBinary\(options\)/);
assert.match(bin, /src-tauri\/src\/main\.rs/);
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

// Covers the data transformations used by --update-config and --prune-config
// without relying on a nested launcher process.
const migratedConfig = mergeConfig(writableConfigDefaults(), {
  keybindings: { prefix: 'Ctrl+Alt' },
});
assert.equal(migratedConfig.keybindings.prefix, 'Ctrl+Alt');
assert.equal(migratedConfig.keybindings.newWindow, 'N');
assert.equal(migratedConfig.terminal.images, undefined);
const prunedConfig = pruneUnsupportedConfig(writableConfigDefaults(), {
  ...migratedConfig,
  retired: { enabled: true },
});
assert.deepEqual(prunedConfig.removed, ['retired']);

const versionResult = runCli('--version');
assert.equal(versionResult.status, 0, versionResult.stderr);
const sourceCommit = spawnSync('git', ['-C', root, 'rev-parse', '--short=12', 'HEAD'], {
  encoding: 'utf8',
});
const expectedVersion = `fpasoterm ${packageJson.version} (commit ${sourceCommit.stdout.trim() || 'unknown'})`;
assert.equal(versionResult.stdout.trim(), expectedVersion);

const shortVersionResult = runCli('-v');
assert.equal(shortVersionResult.status, 0, shortVersionResult.stderr);
assert.equal(shortVersionResult.stdout.trim(), expectedVersion);

const listCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fpasoterm-list-cli-'));
const listMarkerDir = path.join(listCacheDir, 'fpasoterm', 'instances');
fs.mkdirSync(listMarkerDir, { recursive: true });
fs.writeFileSync(path.join(listMarkerDir, `${process.pid}.pid`), JSON.stringify({
  pid: process.pid,
  baseTitle: 'fpasoterm',
  title: 'review-shell',
  createdAt: 1234,
}));
fs.writeFileSync(path.join(listMarkerDir, '999999999.pid'), JSON.stringify({
  pid: 999999999,
  title: 'stale',
  createdAt: 1,
}));
const listResult = spawnSync(process.execPath, [path.join(root, 'bin', 'fpasoterm'), '--list'], {
  encoding: 'utf8',
  env: { ...process.env, XDG_CACHE_HOME: listCacheDir },
});
assert.equal(listResult.status, 0, listResult.stderr);
assert.match(listResult.stdout, new RegExp(`session=${process.pid} pid=${process.pid} title="review-shell" started=`));
assert.doesNotMatch(listResult.stdout, /title="stale"/);
assert.equal(fs.existsSync(path.join(listMarkerDir, '999999999.pid')), false);
const closeResult = spawnSync(process.execPath, [path.join(root, 'bin', 'fpasoterm'), '--close', 'review-shell'], {
  encoding: 'utf8',
  env: { ...process.env, XDG_CACHE_HOME: listCacheDir },
});
assert.equal(closeResult.status, 0, closeResult.stderr);
assert.match(closeResult.stdout, new RegExp(`requested close session=${process.pid}`));
assert.deepEqual(
  JSON.parse(fs.readFileSync(path.join(listCacheDir, 'fpasoterm', 'close.json'), 'utf8')).pids,
  [process.pid],
);
const closeAllResult = spawnSync(process.execPath, [path.join(root, 'bin', 'fpasoterm'), '-q', 'all'], {
  encoding: 'utf8',
  env: { ...process.env, XDG_CACHE_HOME: listCacheDir },
});
assert.equal(closeAllResult.status, 0, closeAllResult.stderr);
assert.match(closeAllResult.stdout, new RegExp(`requested close session=${process.pid}`));
assert.deepEqual(
  JSON.parse(fs.readFileSync(path.join(listCacheDir, 'fpasoterm', 'close.json'), 'utf8')).pids,
  [process.pid],
);
const missingCloseResult = spawnSync(process.execPath, [path.join(root, 'bin', 'fpasoterm'), '-q', 'missing'], {
  encoding: 'utf8',
  env: { ...process.env, XDG_CACHE_HOME: listCacheDir },
});
assert.equal(missingCloseResult.status, 1);
assert.match(missingCloseResult.stderr, /no running window matches: missing/);
assert.doesNotMatch(missingCloseResult.stderr, /Usage: fpasoterm \[options\]/);

const unknownOptionResult = runCli('--foo');
assert.equal(unknownOptionResult.status, 2);
assert.match(unknownOptionResult.stderr, /fpasoterm: unknown option: --foo/);
assert.match(unknownOptionResult.stderr, /Usage: fpasoterm \[options\]/);

for (const unknownOption of ['--hoge', '-?']) {
  const result = runCli(unknownOption);
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes(`unknown option: ${unknownOption}`));
  assert.match(result.stderr, /Usage: fpasoterm \[options\]/);
}

const resetConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fpasoterm-reset-config-'));
const resetConfigPath = path.join(resetConfigDir, 'User', 'config.toml');
const resetStatePath = path.join(resetConfigDir, 'fpasoterm', 'User', 'window-state.json');
fs.mkdirSync(path.dirname(resetConfigPath), { recursive: true });
fs.writeFileSync(resetConfigPath, '[window]\ntitle = "custom"\n');
fs.mkdirSync(path.dirname(resetStatePath), { recursive: true });
fs.writeFileSync(resetStatePath, '{"window":{"width":777,"height":333}}\n');
const resetConfigResult = spawnSync(
  process.execPath,
  [path.join(root, 'bin', 'fpasoterm'), '--config', resetConfigPath, '--reset-config'],
  { encoding: 'utf8', env: { ...process.env, XDG_CONFIG_HOME: resetConfigDir } },
);
assert.equal(resetConfigResult.status, 0, resetConfigResult.stderr);
assert.match(resetConfigResult.stdout, /reset config/);
assert.match(resetConfigResult.stdout, /renamed previous config/);
assert.match(resetConfigResult.stdout, /deleted saved window state/);
const resetConfigValue = toml.parse(fs.readFileSync(resetConfigPath, 'utf8'));
assert.equal(resetConfigValue.window.title, 'fpasoterm');
assert.equal(resetConfigValue.window.width, 1000);
assert.equal(resetConfigValue.window.height, 680);
assert.equal(resetConfigValue.terminal.fontSize, platformDefaultConfig().terminal.fontSize);
assert.equal(resetConfigValue.sync.enabled, false);
const resetBackups = fs.readdirSync(path.dirname(resetConfigPath))
  .filter((name) => name.startsWith('config.toml.backup-'));
assert.equal(resetBackups.length, 1);
assert.match(fs.readFileSync(path.join(path.dirname(resetConfigPath), resetBackups[0]), 'utf8'), /custom/);
assert.equal(fs.existsSync(resetStatePath), false);
fs.rmSync(resetConfigDir, { recursive: true, force: true });

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
  '[keybindings]',
  'prefix = "Ctrl+Alt"',
  '',
].join('\n'));
fs.writeFileSync(path.join(stateTestDir, 'fpasoterm', 'User', 'config.toml.example'), 'old example\n');
writeWindowState({ window: { width: 1200, height: 900 } });
const stateConfig = loadConfig();
const generatedExample = fs.readFileSync(path.join(stateTestDir, 'fpasoterm', 'User', 'config.toml.example'), 'utf8');
assert.match(generatedExample, /# fpasoterm user configuration/);
assert.match(generatedExample, /rememberBounds = true/);
assert.match(generatedExample, /shell = ""/);
assert.equal(windowStatePath(), path.join(stateTestDir, 'fpasoterm', 'User', 'window-state.json'));
assert.equal(stateConfig.config.window.width, 1200);
assert.equal(stateConfig.config.window.height, 900);
assert.equal(stateConfig.config.terminal.shell, '');
assert.equal(stateConfig.config.keybindings.prefix, 'Ctrl+Alt');
assert.equal(stateConfig.config.keybindings.newWindow, 'N');
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
assert.match(installDesktop, /buildLocalBinary/);
assert.match(installDesktop, /cargo',\s*\[/);
assert.match(installDesktop, /writeBuildStamp/);
assert.match(installDesktop, /\.fpasoterm-normal-build\.json/);
assert.match(installDesktop, /FPASOTERM_SKIP_DESKTOP_BUILD/);
assert.match(installDesktop, /installDesktopEntry/);
assert.match(installDesktop, /desktopExec/);
assert.doesNotMatch(installDesktop, /TryExec=/);
assert.match(installDesktop, /currentNodePath/);
assert.match(installDesktop, /INSTALL_NODE=/);
assert.match(installDesktop, /launcher\.log/);
assert.match(installDesktop, /XDG_CACHE_HOME/);
assert.match(installDesktop, /\.cargo\/bin/);
assert.match(installDesktop, /FPASOTERM_LAUNCHER_LOG/);
assert.match(installDesktop, /\/usr\/bin\/node/);
assert.match(installDesktop, /Icon=io\.github\.oyoguhito\.fpasoterm/);
assert.match(installDesktop, /fpasoterm\.desktop/);
assert.match(installDesktop, /io\.github\.oyoguhito\.fpasoterm\.png/);
assert.doesNotMatch(installDesktop, /mise exec node/);
assert.match(installDesktop, /io\.github\.oyoguhito\.FpasoTerm\.desktop/);

const uninstallDesktop = read('scripts/uninstall-linux-desktop.js');
assert.match(uninstallDesktop, /XDG_BIN_HOME/);
assert.match(uninstallDesktop, /removed:/);
assert.match(uninstallDesktop, /io\.github\.oyoguhito\.fpasoterm\.desktop/);
assert.match(uninstallDesktop, /fpasoterm\.desktop/);
assert.match(uninstallDesktop, /io\.github\.oyoguhito\.FpasoTerm\.desktop/);
assert.match(uninstallDesktop, /fpasoterm\.png/);
assert.match(uninstallDesktop, /io\.github\.oyoguhito\.fpasoterm\.png/);
assert.match(uninstallDesktop, /XDG_CONFIG_HOME/);
assert.match(uninstallDesktop, /XDG_CACHE_HOME/);
assert.match(uninstallDesktop, /io\.github\.oyoguhito\.fpasoterm/);
assert.match(uninstallDesktop, /removeDir/);

const uninstallEntry = read('scripts/uninstall-desktop.js');
assert.match(uninstallEntry, /process\.platform === 'win32'/);
assert.match(uninstallEntry, /uninstall-windows-path\.js/);
assert.match(uninstallEntry, /uninstall-linux-desktop\.js/);

const uninstallWindowsPath = read('scripts/uninstall-windows-path.js');
assert.match(uninstallWindowsPath, /GetEnvironmentVariable\('Path', 'User'\)/);
assert.match(uninstallWindowsPath, /SetEnvironmentVariable\('Path'/);
assert.match(uninstallWindowsPath, /isFpasotermPathEntry/);
assert.match(uninstallWindowsPath, /fpasoterm/);
assert.doesNotMatch(uninstallWindowsPath, /setx/i);

const tauriConfig = read('src-tauri/tauri.conf.json');
assert.match(tauriConfig, /"withGlobalTauri": true/);
assert.match(tauriConfig, /"enableGTKAppId": false/);
assert.match(tauriConfig, /"macOSPrivateApi": true/);
assert.match(tauriConfig, /"macOS": \{/);
assert.match(tauriConfig, /"signingIdentity": "-"/);
assert.match(tauriConfig, /"transparent": true/);
assert.match(tauriConfig, /"backgroundColor": "#00000000"/);
assert.match(tauriConfig, /"decorations": false/);

const cargoToml = read('src-tauri/Cargo.toml');
assert.match(cargoToml, new RegExp(`version = "${packageJson.version}"`));
assert.match(cargoToml, /tauri =/);
assert.match(cargoToml, /macos-private-api/);
assert.match(cargoToml, /image-png/);
assert.match(cargoToml, /portable-pty/);
assert.match(cargoToml, /toml =/);
assert.match(cargoToml, /windows-sys/);
assert.match(cargoToml, /Win32_System_Console/);

const tauriCapabilities = read('src-tauri/capabilities/default.json');
assert.match(tauriCapabilities, /core:event:allow-listen/);
assert.match(tauriCapabilities, /core:window:allow-start-resize-dragging/);
assert.match(tauriCapabilities, /"windows": \["main"\]/);

const rustMain = read('src-tauri/src/main.rs');
const rustBuild = read('src-tauri/build.rs');
assert.match(rustBuild, /FPASOTERM_BUILD_COMMIT/);
assert.match(rustBuild, /rev-parse.*HEAD/);
assert.match(rustBuild, /rerun-if-changed/);
assert.match(rustMain, /windows_subsystem = "windows"/);
assert.match(rustMain, /HELP_TEXT/);
assert.match(rustMain, /apply_direct_cli_env_overrides/);
assert.match(rustMain, /set_env_from_cli/);
assert.match(rustMain, /sanitize_cli_value/);
assert.match(rustMain, /set_env_from_cli\("FPASOTERM_SHELL"/);
assert.match(rustMain, /set_env_from_cli\("FPASOTERM_WINDOW_TITLE"/);
assert.match(rustMain, /FPASOTERM_WINDOW_TITLE_LOCKED/);
assert.match(rustMain, /title_locked/);
assert.match(rustMain, /set_env_from_cli\("FPASOTERM_START_COMMAND"/);
assert.match(rustMain, /cli_has_flag\(&\["--help", "-h"\]\)/);
assert.match(rustMain, /fn cli_help_text/);
assert.match(rustMain, /print_cli_text\(&cli_help_text\(\)\)/);
assert.match(rustMain, /cli_has_flag\(&\["--version", "-v"\]\)/);
assert.match(rustMain, /cli_has_flag\(&\["--list", "-l"\]\)/);
assert.match(rustMain, /fn print_running_instances/);
assert.match(rustMain, /fn broadcast_targeted_close_request/);
assert.match(rustMain, /cli_option_value_any\(&\["--close", "-q"\]\)/);
assert.match(rustMain, /cli_has_flag\(&\["--reset-config", "-R"\]\)/);
assert.match(rustMain, /fn reset_config_cli/);
assert.match(rustMain, /fn app_version/);
assert.match(rustMain, /FPASOTERM_BUILD_COMMIT/);
assert.match(rustMain, /commit \{\}/);
assert.match(rustMain, /fn exit_requested_app_instance/);
assert.match(rustMain, /app\.exit\(0\)/);
assert.match(rustMain, /stdout\.flush/);
assert.match(rustMain, /fn write_macos_cli_shim/);
assert.match(rustMain, /join\("\.local"\)\.join\("bin"\)/);
assert.match(rustMain, /joined_terminal_path\(vec!\[local_bin_dir, config_bin_dir, app_dir\]\)/);
assert.match(rustMain, /exec \{quoted_executable\} \\"\$@\\"/);
assert.match(rustMain, /fn shell_single_quote/);
assert.match(rustMain, /fn close_request_path/);
assert.match(rustMain, /"baseTitle": title/);
assert.match(rustMain, /fn instance_marker_is_fresh/);
assert.match(rustMain, /INSTANCE_HEARTBEAT_INTERVAL/);
assert.match(rustMain, /fn instance_number_from_display_title/);
assert.match(rustMain, /fn tile_grid/);
assert.match(rustMain, /fn detach_nested_macos_launch/);
assert.match(rustMain, /command\.env\("PATH", path_value\)/);
assert.match(rustMain, /CARGO_PKG_VERSION/);
assert.match(rustMain, /cli_has_flag\(&\["--show-config"\]\)/);
assert.match(rustMain, /print_show_config/);
assert.match(rustMain, /cli_has_flag\(&\["--reset-window-state", "-r"\]\)/);
assert.match(rustMain, /reset_window_state_cli/);
assert.match(rustMain, /print_cli_text_windows/);
assert.match(rustMain, /AttachConsole/);
assert.match(rustMain, /CONOUT\$/);
assert.match(rustMain, /portable_pty/);
assert.match(rustMain, /ChildKiller/);
assert.match(rustMain, /terminal_start/);
assert.match(rustMain, /terminal_write/);
assert.match(rustMain, /terminal_resize/);
assert.match(rustMain, /diagnostics:event/);
assert.match(rustMain, /command\.env\("TERM", "xterm-256color"\)/);
assert.match(rustMain, /TERM_PROGRAM/);
assert.match(rustMain, /config_apply_path/);
assert.match(rustMain, /runtime_config_from_path/);
assert.match(rustMain, /direct_runtime_config/);
assert.match(rustMain, /apply_direct_cli_overrides/);
assert.match(rustMain, /merge_runtime_config_from_path/);
assert.match(rustMain, /merge_json_value/);
assert.match(rustMain, /applied runtime config/);
assert.match(rustMain, /terminal_write bytes/);
assert.match(rustMain, /read_configured_shell/);
assert.match(rustMain, /FPASOTERM_SHELL/);
assert.match(rustMain, /FPASOTERM_WINDOW_TITLE/);
assert.match(rustMain, /FPASOTERM_TITLEBAR_COLOR/);
assert.match(rustMain, /cli_option_value/);
assert.match(rustMain, /cli_option_value_any\(&\["--shell", "-s"\]\)/);
assert.match(rustMain, /cli_option_value_any\(&\["--config", "-c"\]\)/);
assert.match(rustMain, /cli_option_value_any\(&\["--title", "-t"\]\)/);
assert.match(rustMain, /cli_option_value_any\(&\["--titlebar-color", "-b"\]\)/);
assert.match(rustMain, /cli_option_value_any\(&\["--command", "-e"\]\)/);
assert.match(rustMain, /cli_positive_u32_option_any\(&\["--width", "-W"\]\)/);
assert.match(rustMain, /cli_positive_u32_option_any\(&\["--height", "-H"\]\)/);
assert.match(rustMain, /cli_size_option/);
assert.match(rustMain, /cli_has_flag\(&\["--debug-keys", "-k"\]\)/);
assert.match(rustMain, /cli_has_flag\(&\["--console-diagnostics", "-C"\]\)/);
assert.match(rustMain, /cli_has_flag\(&\["--debug-opaque-terminal"\]\)/);
assert.match(rustMain, /cli_has_flag\(&\["--disable-dmabuf"\]\)/);
assert.match(rustMain, /resolve_shell_command/);
assert.match(rustMain, /sanitize_shell_value/);
assert.match(rustMain, /resolve_windows_shell/);
assert.match(rustMain, /default_windows_shell/);
assert.match(rustMain, /windows_pwsh_candidates/);
assert.match(rustMain, /windows_path_executable/);
assert.match(rustMain, /terminal_path_with_app_dir/);
assert.match(rustMain, /env::current_exe/);
assert.match(rustMain, /command\.env\("Path", path_value\)/);
assert.match(rustMain, /replace\('\\0', ""\)/);
assert.match(rustMain, /PowerShell\\\\7\\\\pwsh\.exe/);
assert.match(rustMain, /clone_killer/);
assert.match(rustMain, /\.wait\(\)/);
assert.match(rustMain, /macos_login_shell/);
assert.match(rustMain, /dscl/);
assert.match(rustMain, /read_saved_window_size/);
assert.match(rustMain, /window-state\.json/);
assert.match(rustMain, /UserShell/);
assert.match(rustMain, /window_save_bounds/);
assert.match(rustMain, /window_get_bounds/);
assert.match(rustMain, /window_set_bounds/);
assert.match(rustMain, /window_minimize/);
assert.match(rustMain, /window_toggle_maximize/);
assert.match(rustMain, /fn window_arrange/);
assert.match(rustMain, /fn window_close_all/);
assert.match(rustMain, /fn window_new/);
assert.match(rustMain, /spawn_new_instance/);
assert.match(rustMain, /fn window_confirm_close_all/);
assert.match(rustMain, /fn window_close_all_confirmed/);
assert.match(rustMain, /fn windows_confirm_close_all/);
assert.match(rustMain, /MessageBoxW/);
assert.match(rustMain, /MB_OKCANCEL/);
assert.match(rustMain, /WebviewWindowBuilder/);
assert.match(rustMain, /OpenProcess/);
assert.match(rustMain, /GetExitCodeProcess/);
assert.match(rustMain, /PROCESS_QUERY_LIMITED_INFORMATION/);
assert.match(rustMain, /\.decorations\(true\)/);
assert.match(rustMain, /\.transparent\(false\)/);
assert.match(rustMain, /\.visible\(true\)/);
assert.match(rustMain, /\.always_on_top\(true\)/);
assert.match(rustMain, /window\.set_focus\(\)/);
assert.match(rustMain, /fn window_focus_main/);
assert.match(rustMain, /fn window_cancel_close_all/);
assert.match(rustMain, /Ignore a close request left by an earlier application session/);
assert.match(rustMain, /close_all_request_path/);
assert.match(rustMain, /start_arrange_listener/);
assert.match(rustMain, /ArrangeRequest/);
assert.match(rustMain, /fpasoterm-debug\.log/);
assert.match(rustMain, /arrange tile minimum override/);
assert.match(rustMain, /arrange requested windows=.*cells=/);
assert.match(rustMain, /let \(columns, rows\) = tile_grid\(count\)/);
assert.doesNotMatch(rustMain, /width_capacity/);
assert.match(rustMain, /startup window size restore skipped because Tile was requested/);
assert.match(rustMain, /arrange immediate pid=/);
assert.match(rustMain, /tile_gap/);
assert.match(rustMain, /scale_factor/);
assert.match(rustMain, /footprint_width/);
assert.match(rustMain, /renderer-available/);
assert.match(rustMain, /coordinate_scale/);
assert.match(rustMain, /renderer-available-scaled/);
assert.match(rustMain, /GDK_BACKEND/);
assert.match(rustMain, /PhysicalSize::new\(\s*config\.config\.window\.min_width/);
assert.match(rustMain, /ArrangeScreen/);
assert.match(rustMain, /\.minimize\(\)/);
assert.match(rustMain, /\.maximize\(\)/);
assert.match(rustMain, /\.unmaximize\(\)/);
assert.match(rustMain, /set_title/);
assert.match(rustMain, /set_fpasoterm_window_icon/);
assert.match(rustMain, /include_bytes!\("\.\.\/\.\.\/extra\/logo\/fpasoterm\.png"\)/);
assert.doesNotMatch(rustMain, /default_window_icon/);
assert.match(rustMain, /\.set_icon\(icon\)/);
assert.match(rustMain, /PhysicalPosition/);
assert.match(rustMain, /restoring window size/);
assert.match(rustMain, /PhysicalSize::new\(config\.config\.window\.width/);
assert.match(rustMain, /schedule_startup_size_restore/);
assert.match(rustMain, /Duration::from_millis\(650\)/);
assert.match(rustMain, /startup window size restore requested/);
assert.match(rustMain, /claim_instance_index/);
assert.match(rustMain, /InstanceMarker/);
assert.match(rustMain, /startup same-title instance index/);
assert.match(rustMain, /apply_instance_identity/);
assert.match(rustMain, /varied_titlebar_color/);
assert.match(rustMain, /parse_css_color/);
assert.match(rustMain, /publish_runtime_config/);
assert.match(rustMain, /format!\("\{\}-\{\}"/);
assert.match(rustMain, /cache_dir_path/);
assert.match(rustMain, /WindowEvent::Resized\(size\)/);
assert.match(rustMain, /save_window_size\(\*size/);
assert.doesNotMatch(rustMain, /WindowEvent::Moved/);
assert.doesNotMatch(rustMain, /WindowEvent::Destroyed/);
assert.match(rustMain, /config_get/);
assert.match(rustMain, /WEBKIT_DISABLE_DMABUF_RENDERER/);
assert.match(rustMain, /FPASOTERM_RUNTIME_CONFIG_JSON/);
assert.match(rustMain, /sync_status/);
assert.doesNotMatch(rustMain, /sync_write_clipboard/);
assert.doesNotMatch(rustMain, /sync_read_clipboard/);
assert.match(rustMain, /sync_write_diagnostics/);
assert.match(rustMain, /clipboard_read/);
assert.match(rustMain, /clipboard_write/);
assert.match(rustMain, /clipboard_read_output/);
assert.match(rustMain, /timeout/);
assert.match(rustMain, /remain alive as the clipboard owner/);
assert.match(rustMain, /program == "wl-copy"/);
assert.match(rustMain, /wl-paste/);
assert.match(rustMain, /--type", "text\/plain/);
assert.match(rustMain, /xclip/);
assert.match(rustMain, /UTF8_STRING/);
assert.match(rustMain, /pbpaste/);
assert.match(rustMain, /Get-Clipboard -Raw/);
assert.match(rustMain, /WINDOWS_CF_UNICODETEXT/);
assert.match(rustMain, /read_windows_clipboard_native/);
assert.match(rustMain, /write_windows_clipboard_native/);
assert.match(rustMain, /String::from_utf16_lossy/);
assert.match(rustMain, /SetClipboardData\(WINDOWS_CF_UNICODETEXT/);
assert.match(rustMain, /text\.encode_utf16\(\)/);
assert.match(rustMain, /read_windows_clipboard_with_powershell/);
assert.match(rustMain, /write_windows_clipboard_with_powershell/);
assert.match(rustMain, /windows_clipboard_temp_path/);
assert.match(rustMain, /strip_utf8_bom/);
assert.match(rustMain, /Set-Content -LiteralPath \$args\[0\] -Encoding UTF8/);
assert.match(rustMain, /Get-Content -LiteralPath \$args\[0\] -Raw -Encoding UTF8/);
assert.doesNotMatch(rustMain, /Set-Clipboard -Value \(\[Console\]::In\.ReadToEnd\(\)\)/);
assert.doesNotMatch(rustMain, removedSnakeHttpUiPattern);
assert.doesNotMatch(rustMain, removedKebabHttpUiPattern);
assert.doesNotMatch(rustMain, /TcpListener::bind/);
assert.doesNotMatch(rustMain, /handle\.join\(\)/);
assert.match(rustMain, /terminal_log_start/);
assert.match(rustMain, /terminal_log_stop/);
assert.match(rustMain, /terminal_log_status/);
assert.match(rustMain, /terminal_log_show/);
assert.match(rustMain, /terminal_log_clear/);
assert.match(rustMain, /terminal_log_list/);
assert.match(rustMain, /terminal_log_delete/);
assert.match(rustMain, /TerminalLogPreview/);
assert.match(rustMain, /TerminalLogItem/);
assert.match(rustMain, /last_terminal_log_path/);
assert.match(rustMain, /latest_terminal_log_path/);
assert.match(rustMain, /read_terminal_log_tail/);
assert.match(rustMain, /clean_terminal_log_preview_text/);
assert.match(rustMain, /struct TerminalOutputDecoder/);
assert.match(rustMain, /struct TerminalTextNormalizer/);
assert.match(rustMain, /jis_x0201_kana/);
assert.match(rustMain, /jis_x0201_half_width_kana/);
assert.match(rustMain, /utf8_sequence_width/);
assert.match(rustMain, /decoder\.decode\(&buffer\[..read\]\)/);
assert.match(rustMain, /log\.normalizer\.normalize\(&text\)/);
assert.match(rustMain, /terminal_output_decoder_preserves_utf8/);
assert.match(rustMain, /terminal_output_decoder_maps_shift_jis_half_width_kana/);
assert.match(rustMain, /terminal_output_decoder_maps_invalid_utf8_half_width_kana_bytes/);
assert.match(rustMain, /terminal_output_decoder_maps_iso2022_half_width_kana_across_chunks/);
assert.match(rustMain, /terminal_text_normalizer_converts_cursor_rows_to_newlines/);
assert.match(rustMain, /terminal_text_normalizer_keeps_cursor_forward_as_spaces/);
assert.match(rustMain, /terminal_text_normalizer_composes_japanese_voicing_marks/);
assert.match(rustMain, /terminal_text_normalizer_preserves_half_width_kana/);
assert.match(rustMain, /Appends cleaned PTY output bytes/);
assert.match(rustMain, /first_csi_numeric_parameter/);
assert.match(rustMain, /first_two_csi_numeric_parameters/);
assert.doesNotMatch(rustMain, /push_terminal_preview_newline/);
assert.match(rustMain, /struct TerminalLog/);
assert.match(rustMain, /append_terminal_log/);
assert.match(rustMain, /stopped log files deleted/);
assert.match(rustMain, /terminal output log files deleted/);
assert.match(rustMain, /selected terminal output log deleted/);
assert.match(rustMain, /delete_or_clear_terminal_log_file/);
assert.match(rustMain, /locked log files emptied/);
assert.match(rustMain, /terminal-\{\}-\{\}\.log/);
assert.match(rustMain, /log_file_component/);
assert.match(rustMain, /terminal_broadcast/);
assert.match(rustMain, /TerminalBroadcastItem/);
assert.match(rustMain, /sync_command_directory/);
assert.match(rustMain, /target_instance_ids/);
assert.match(rustMain, /terminal_broadcast_targets/);
assert.match(rustMain, /live_terminal_broadcast_targets/);
assert.match(rustMain, /expand_path_variables/);
assert.match(rustMain, /env::var\(&name\)/);
assert.match(rustMain, /SyncItem/);
assert.doesNotMatch(rustMain, /clipboard\.json/);
assert.match(rustMain, /diagnostics\.json/);

const indexHtml = read('src/renderer/index.html');
assert.match(indexHtml, /id="terminal-broadcast-target-list"/);
assert.match(indexHtml, /Select All/);
assert.match(indexHtml, /Select None/);
const confirmHtml = read('src/renderer/confirm.html');
assert.match(indexHtml, /id="drag-region"/);
assert.match(indexHtml, /id="window-title"/);
assert.match(indexHtml, /id="window-controls"/);
assert.doesNotMatch(indexHtml, /id="sync-menu"/);
assert.doesNotMatch(indexHtml, /id="sync-status"/);
assert.doesNotMatch(indexHtml, /id="sync-menu-toggle"/);
assert.doesNotMatch(indexHtml, /id="sync-menu-items"/);
assert.doesNotMatch(indexHtml, /id="sync-copy"/);
assert.doesNotMatch(indexHtml, /id="sync-paste"/);
assert.doesNotMatch(indexHtml, /id="sync-diagnostics"/);
assert.doesNotMatch(indexHtml, /Copy Selection/);
assert.doesNotMatch(indexHtml, /Pull to Clipboard/);
assert.doesNotMatch(indexHtml, /Write Diagnostics/);
assert.doesNotMatch(indexHtml, /id="copy-diagnostics"/);
assert.match(indexHtml, /id="close-diagnostics"/);
assert.doesNotMatch(indexHtml, removedKebabHttpUiPattern);
assert.doesNotMatch(indexHtml, /id="log-menu"/);
assert.doesNotMatch(indexHtml, /id="log-menu-toggle"/);
assert.match(indexHtml, /id="terminal-log-status" hidden aria-live="polite">Logging</);
assert.doesNotMatch(indexHtml, /id="log-menu-items"/);
assert.match(indexHtml, /id="terminal-log-toggle"/);
assert.match(indexHtml, /id="terminal-log-show"/);
assert.match(indexHtml, /id="terminal-copy"/);
assert.match(indexHtml, /id="terminal-paste"/);
assert.match(indexHtml, /id="keybinding-prefix"/);
assert.match(indexHtml, /Shortcut prefix: Ctrl\+Shift/);
assert.match(indexHtml, /aria-keyshortcuts="[^"]*Control\+Shift\+L[^"]*"/);
assert.match(indexHtml, /aria-keyshortcuts="Control\+Shift\+S"/);
assert.match(indexHtml, /aria-keyshortcuts="Control\+Shift\+P"/);
assert.match(indexHtml, /aria-keyshortcuts="Control\+Shift\+C"/);
assert.match(indexHtml, /aria-keyshortcuts="Control\+Shift\+V"/);
assert.doesNotMatch(indexHtml, /id="terminal-log-clear"/);
assert.match(indexHtml, /id="terminal-log-select"/);
assert.match(indexHtml, /id="terminal-log-search"/);
assert.match(indexHtml, /id="terminal-log-search-next"/);
assert.match(indexHtml, /Use N for next and P for previous/);
assert.match(indexHtml, /id="terminal-log-search-status"/);
assert.match(indexHtml, /id="terminal-log-show-selected"/);
assert.match(indexHtml, /id="terminal-log-delete-selected"/);
assert.match(indexHtml, /id="terminal-log-delete-all"/);
assert.match(indexHtml, /id="diagnostics-panel" hidden tabindex="-1"/);
assert.match(indexHtml, /id="terminal-log-confirm"/);
assert.match(indexHtml, /role="dialog"/);
assert.match(indexHtml, /id="terminal-log-confirm-ok"/);
assert.match(indexHtml, /id="terminal-log-confirm-cancel"/);
assert.doesNotMatch(indexHtml, />Log \(\^L\)</);
assert.match(indexHtml, />Log Start \(S\)</);
assert.match(indexHtml, />Log Show \(P\)</);
assert.match(indexHtml, />Copy \(C\)</);
assert.match(indexHtml, />Paste \(V\)</);
assert.doesNotMatch(indexHtml, />Clear</);
assert.match(indexHtml, /id="minimize-window"/);
assert.match(indexHtml, /id="maximize-window"/);
assert.match(indexHtml, /id="new-window"/);
assert.match(indexHtml, />New \(N\)</);
assert.match(indexHtml, /aria-keyshortcuts="Control\+Shift\+N"/);
assert.match(indexHtml, /id="arrange-window"/);
assert.match(indexHtml, /id="close-all-windows"/);
assert.match(indexHtml, />Close All \(X\)</);
assert.match(indexHtml, /aria-keyshortcuts="Control\+Shift\+X"/);
assert.match(indexHtml, /id="close-all-confirm" hidden role="dialog"/);
assert.match(indexHtml, /id="close-all-confirm-ok"/);
assert.match(indexHtml, /id="close-all-confirm-cancel"/);
assert.match(confirmHtml, /Close all fpasoterm windows/);
assert.match(confirmHtml, /window_close_all_confirmed/);
assert.match(confirmHtml, /event\.key === 'Tab'/);
assert.match(confirmHtml, /event\.key === 'Enter'/);
assert.match(confirmHtml, /currentWindow\.setFocus/);
assert.match(confirmHtml, /cancel\.focus/);
assert.match(confirmHtml, /window_cancel_close_all/);
assert.match(indexHtml, />Tile \(T\)</);
assert.match(indexHtml, /aria-keyshortcuts="Control\+Shift\+T"/);
assert.match(indexHtml, /id="window-menu-toggle"/);
assert.match(indexHtml, /id="window-menu-toggle"[^>]+aria-keyshortcuts="Control\+Shift\+M Control\+Shift\+L"/);
assert.match(indexHtml, /id="keyboard-shortcuts-help"/);
assert.match(indexHtml, />Help \(H\)</);
assert.match(indexHtml, /aria-keyshortcuts="Control\+Shift\+H"/);
assert.match(indexHtml, /id="window-menu-items"/);
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
assert.match(readme, /docs\/sync\.en\.md/);
assert.match(readme, /README\.ja\.md/);
assert.match(readme, /INSTALL\.ja\.md/);
assert.doesNotMatch(readme, removedTemporaryHttpUiDocPattern);
assert.match(readme, /--setup-sync/);
assert.match(readme, /node \.\\bin\\fpasoterm --setup-sync/);
assert.match(readme, /docs\/pr-review\.en\.md/);
assert.match(readme, /examples\/plugins/);
assert.match(readme, /--shell/);
assert.match(readme, /PowerShell\\7\\pwsh\.exe/);
assert.match(readme, /PowerShell 7 \(`pwsh\.exe`\) by default/);
assert.match(readme, /fpasoterm executable directory at the[\s\S]*front of `Path`/);
assert.match(readme, /GTK application id is disabled/);
assert.match(readme, /Tile \(\^T\)/);
assert.match(readme, /ChromeOS shelf/);
assert.match(readme, /removes fpasoterm-specific directories from the[\s\S]*current user's `Path`/);
assert.match(readme, /By default, fpasoterm keeps its configured title/);
assert.match(readme, /--command/);
assert.match(readme, /--version/);
assert.match(readme, /fpasoterm -v/);
assert.match(readme, /--reset-window-state/);
assert.match(readme, /--disable-dmabuf/);
assert.match(readme, /OSC 777|033\]777/);
assert.match(readme, /POSIX shell/);
assert.match(readme, /Windows PowerShell and cmd\.exe do not run those `printf` examples as-is/);
assert.match(readme, /\[Console\]::Write\("\$\(\[char\]27\)\]777;title=work;titlebarColor=#2e7d32/);
assert.match(readme, /examples\/config\/runtime-appearance\.toml/);
assert.match(readme, /apply-runtime-appearance\.sh/);
assert.match(readme, /apply-runtime-appearance\.ps1/);
assert.match(readme, /apply-runtime-appearance\.bat/);
assert.match(readme, /\\a\\r\\n/);
assert.match(readme, /Runtime config application keeps the current shell session running/);
assert.match(readme, /window-state\.json/);
assert.match(readme, /known-issues\.en\.md/);
assert.match(readme, /Google Drive API or OAuth/);
assert.doesNotMatch(readme, /temporary read-only/);
assert.doesNotMatch(readme, /一時的なリモート出力取得/);

const configDocsEn = read('docs/config.en.md');
assert.match(configDocsEn, /\[window\]/);
assert.match(configDocsEn, /title = "fpasoterm"/);
assert.match(configDocsEn, /width = 1000/);
assert.match(configDocsEn, /height = 680/);
assert.match(configDocsEn, /titlebarColor = "#1565c0"/);
assert.match(configDocsEn, /titleLocked = true/);
assert.match(configDocsEn, /titleLocked` defaults to `true`/);
assert.match(configDocsEn, /shell-emitted title changes are ignored/);
assert.match(configDocsEn, /rememberBounds = true/);
assert.match(configDocsEn, /frame = false/);
assert.match(configDocsEn, /allowTransparency = true/);
assert.match(configDocsEn, /backgroundOpacity = 0\.8/);
assert.match(configDocsEn, /termName = "xterm-256color"/);
assert.match(configDocsEn, /fontSize = 14/);
assert.match(configDocsEn, /lineHeight = 1\.12/);
assert.match(configDocsEn, /terminal\.lineHeight/);
assert.match(configDocsEn, /minimumContrastRatio = 4\.5/);
assert.match(configDocsEn, /ANSI foreground colors/);
assert.match(configDocsEn, /rescaleOverlappingGlyphs = true/);
assert.match(configDocsEn, /half-width kana/);
assert.match(configDocsEn, /shell = ""/);
assert.match(configDocsEn, /pwsh\.exe/);
assert.match(configDocsEn, /PowerShell 7 \(`pwsh\.exe`\) is the default/);
assert.match(configDocsEn, /PowerShell\\7\\pwsh\.exe/);
assert.match(configDocsEn, /On Windows/);
assert.match(configDocsEn, /\.config\/fpasoterm\/bin\/fpasoterm/);
assert.match(configDocsEn, /\.local\/bin\/fpasoterm/);
assert.match(configDocsEn, /forwards every argument unchanged/);
assert.match(configDocsEn, /nested macOS GUI launch detaches/);
assert.match(configDocsEn, /duplicateWindowMs = 800/);
assert.match(configDocsEn, /window-state\.json/);
assert.match(configDocsEn, /same table to be defined more than once/);
assert.match(configDocsEn, /OSC 777/);
assert.match(configDocsEn, /The following `printf` examples are for POSIX shells/);
assert.match(configDocsEn, /They do not run as-is in Windows PowerShell or cmd\.exe/);
assert.match(configDocsEn, /\[Console\]::Write\("\$\(\[char\]27\)\]777;title=work;titlebarColor=#2e7d32/);
assert.match(configDocsEn, /titlebarColor=#2e7d32/);
assert.match(configDocsEn, /opacity=0\.65/);
assert.match(configDocsEn, /examples\/config\/runtime-appearance\.toml/);
assert.match(configDocsEn, /apply-runtime-appearance\.sh/);
assert.match(configDocsEn, /apply-runtime-appearance\.ps1/);
assert.match(configDocsEn, /apply-runtime-appearance\.bat/);
assert.match(configDocsEn, /RUNTIME SAMPLE ACTIVE/);
assert.match(configDocsEn, /apply-default-appearance\.sh/);
assert.match(configDocsEn, /apply-default-appearance\.ps1/);
assert.match(configDocsEn, /apply-default-appearance\.bat/);
assert.match(configDocsEn, /\\a\\r\\n/);
assert.match(configDocsEn, /Settings that require a new PTY/);
assert.match(configDocsEn, /TERM=xterm-256color/);
assert.match(configDocsEn, /Do not run `kitten icat`, `chafa --format kitty`, or `chafa --format sixels`/);
assert.match(configDocsEn, /`\[terminal\.images\]` is reserved and ignored by current builds/);
assert.match(configDocsEn, /\[sync\]/);
assert.match(configDocsEn, /provider = "folder"/);
assert.match(configDocsEn, /sync\.en\.md/);
assert.match(configDocsEn, /\[logging\]/);
assert.match(configDocsEn, /Ctrl\+Shift\+L/);
assert.match(configDocsEn, /Ctrl\+Shift\+S/);
assert.match(configDocsEn, /Ctrl\+Shift\+P/);
assert.match(configDocsEn, /Ctrl\+Esc.*invalid/);
assert.match(configDocsEn, /Ctrl\+Alt\+Escape/);
assert.match(configDocsEn, /absolute path of the configuration/);
assert.match(configDocsEn, /--update-config/);
assert.match(configDocsEn, /--prune-config/);
assert.match(configDocsEn, /Delete All/);
assert.match(configDocsEn, /opens a selector/);
assert.match(configDocsEn, /delete the selected stopped log/);
assert.match(configDocsEn, /readable terminal output with control sequences removed/);
assert.match(configDocsEn, /%USERPROFILE%/);
assert.match(configDocsEn, /\$HOME/);
assert.match(configDocsEn, /most portable form/);
assert.doesNotMatch(configDocsEn, /\[web[C]onsole\]/);
assert.match(configDocsEn, /log=start/);

const configDocsJa = read('docs/config.ja.md');
assert.match(configDocsJa, /全デフォルト/);
assert.match(configDocsJa, /\[window\]/);
assert.match(configDocsJa, /examples\/plugins/);
assert.match(configDocsJa, /title = "fpasoterm"/);
assert.match(configDocsJa, /titlebarColor = "#1565c0"/);
assert.match(configDocsJa, /titleLocked = true/);
assert.match(configDocsJa, /`titleLocked` は既定で `true`/);
assert.match(configDocsJa, /shell が送る title change は無視/);
assert.match(configDocsJa, /rememberBounds = true/);
assert.match(configDocsJa, /frame = false/);
assert.match(configDocsJa, /allowTransparency = true/);
assert.match(configDocsJa, /backgroundOpacity = 0\.8/);
assert.match(configDocsJa, /termName = "xterm-256color"/);
assert.match(configDocsJa, /lineHeight = 1\.12/);
assert.match(configDocsJa, /terminal\.lineHeight/);
assert.match(configDocsJa, /minimumContrastRatio = 4\.5/);
assert.match(configDocsJa, /ANSI foreground/);
assert.match(configDocsJa, /rescaleOverlappingGlyphs = true/);
assert.match(configDocsJa, /半角カタカナ/);
assert.match(configDocsJa, /shell = ""/);
assert.match(configDocsJa, /pwsh\.exe/);
assert.match(configDocsJa, /PowerShell 7 \(`pwsh\.exe`\) が利用可能な場合に既定 shell/);
assert.match(configDocsJa, /PowerShell\\7\\pwsh\.exe/);
assert.match(configDocsJa, /Windowsでは/);
assert.match(configDocsJa, /\.config\/fpasoterm\/bin\/fpasoterm/);
assert.match(configDocsJa, /全引数を変更せず転送/);
assert.match(configDocsJa, /新しいGUIを起動する場合は既定でprocessを切り離/);
assert.match(configDocsJa, /window-state\.json/);
assert.match(configDocsJa, /同じ table を複数回定義できません/);
assert.match(configDocsJa, /OSC 777/);
assert.match(configDocsJa, /`printf` 例は POSIX shell/);
assert.match(configDocsJa, /PowerShell や cmd\.exe ではそのまま使えません/);
assert.match(configDocsJa, /\[Console\]::Write\("\$\(\[char\]27\)\]777;title=work;titlebarColor=#2e7d32/);
assert.match(configDocsJa, /titlebarColor=#2e7d32/);
assert.match(configDocsJa, /opacity=0\.65/);
assert.match(configDocsJa, /examples\/config\/runtime-appearance\.toml/);
assert.match(configDocsJa, /apply-runtime-appearance\.sh/);
assert.match(configDocsJa, /apply-runtime-appearance\.ps1/);
assert.match(configDocsJa, /apply-runtime-appearance\.bat/);
assert.match(configDocsJa, /RUNTIME SAMPLE ACTIVE/);
assert.match(configDocsJa, /apply-default-appearance\.sh/);
assert.match(configDocsJa, /apply-default-appearance\.ps1/);
assert.match(configDocsJa, /apply-default-appearance\.bat/);
assert.match(configDocsJa, /\\a\\r\\n/);
assert.match(configDocsJa, /現在の shell session は維持されます/);
assert.match(configDocsJa, /TERM=xterm-256color/);
assert.match(configDocsJa, /\[sync\]/);
assert.match(configDocsJa, /provider = "folder"/);
assert.match(configDocsJa, /sync\.ja\.md/);
assert.match(configDocsJa, /\[logging\]/);
assert.match(configDocsJa, /Ctrl\+Shift\+L/);
assert.match(configDocsJa, /Ctrl\+Shift\+S/);
assert.match(configDocsJa, /Ctrl\+Shift\+P/);
assert.match(configDocsJa, /Ctrl\+Esc.*無効/);
assert.match(configDocsJa, /Ctrl\+Alt\+Escape/);
assert.match(configDocsJa, /設定ファイルの絶対path/);
assert.match(configDocsJa, /--update-config/);
assert.match(configDocsJa, /--prune-config/);
assert.match(configDocsJa, /Delete All/);
assert.match(configDocsJa, /一覧から表示対象を選択/);
assert.match(configDocsJa, /選択した停止済み log/);
assert.match(configDocsJa, /制御シーケンスを除去した readable terminal output/);
assert.match(configDocsJa, /%USERPROFILE%/);
assert.match(configDocsJa, /\$HOME/);
assert.match(configDocsJa, /最も扱いやすい指定/);
assert.doesNotMatch(configDocsJa, /\[web[C]onsole\]/);
assert.match(configDocsJa, /log=start/);

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

const specEn = read('docs/spec.en.md');
assert.doesNotMatch(specEn, removedTemporaryHttpUiPattern);
assert.match(specEn, /OSC 52 copy requests/);
assert.match(specEn, /selected terminal text/);
assert.match(specEn, /hamburger window menu contains `Log Start/);
assert.match(specEn, /`Ctrl\+Shift\+L` opens that menu/);
assert.match(specEn, /`Ctrl\+Shift\+M` opens the window menu/);
assert.match(specEn, /`Help \(\^H\)` item or `Ctrl\+Shift\+H`/);
assert.match(specEn, /`Kill \(\^K\)`, `Copy \(\^C\)`, and `Paste \(\^V\)`/);
assert.match(specEn, /On Unix, `Kill \(\^K\)` or `Ctrl\+Shift\+K` sends `SIGKILL` to the foreground PTY process group/);
assert.match(specEn, /On Windows, it force-terminates descendants of the terminal shell/);
assert.match(specEn, /diagnostics and log panel textareas/);
assert.match(specEn, /Terminal paste first reads the WebView clipboard API/);
assert.match(specEn, /otherwise it pastes/);
assert.match(specEn, /Pane-specific logging is delegated to multiplexers/);

const specJa = read('docs/spec.ja.md');
assert.doesNotMatch(specJa, removedTemporaryHttpUiPattern);
assert.match(specJa, /OSC 52 copy request/);
assert.match(specJa, /選択した terminal text/);
assert.match(specJa, /hamburger の window menu には `Log Start/);
assert.match(specJa, /`Ctrl\+Shift\+L` は log 操作に focus/);
assert.match(specJa, /`Ctrl\+Shift\+M` で window menu を開き/);
assert.match(specJa, /`Help \(\^H\)` または `Ctrl\+Shift\+H`/);
assert.match(specJa, /`Kill \(\^K\)`、`Copy \(\^C\)`、`Paste \(\^V\)`/);
assert.match(specJa, /`Ctrl\+Shift\+K` が前景 PTY process group に `SIGKILL` を送ります/);
assert.match(specJa, /Windowsではterminal shellの子孫processを深い順に強制終了/);
assert.match(specJa, /diagnostics \/ log panel の textarea/);
assert.match(specJa, /terminal paste は、user gesture中のWebView clipboard APIを先に読み/);
assert.match(specJa, /selection がない場合は paste/);
assert.match(specJa, /pane 単位の log は tmux/);

const prReviewEn = read('docs/pr-review.en.md');
assert.match(prReviewEn, /Ordinary pull requests do not include release artifacts/);
assert.match(prReviewEn, /gh pr checkout <number>/);
assert.match(prReviewEn, /fpasoterm\.exe --help/);
assert.match(prReviewEn, /Do not use tag release assets as substitutes for PR artifacts/);
assert.match(prReviewEn, /pull_request/);

const prReviewJa = read('docs/pr-review.ja.md');
assert.match(prReviewJa, /通常の pull request には/);
assert.match(prReviewJa, /gh pr checkout <number>/);
assert.match(prReviewJa, /fpasoterm\.exe --help/);
assert.match(prReviewJa, /tag release asset は PR artifact の代わりには使いません/);
assert.match(prReviewJa, /pull_request/);

const samplePlugin = read('examples/plugins/hello.ts');
assert.match(samplePlugin, /fpasotermPluginApi/);

const sampleConfig = read('examples/config/with-plugins.toml');
assert.match(sampleConfig, /\[plugins\]/);
assert.match(sampleConfig, /plugins\/hello\.ts/);
assert.match(sampleConfig, /shell = ""/);
assert.match(sampleConfig, /titlebarColor = "#1565c0"/);
assert.match(sampleConfig, /backgroundOpacity = 0\.8/);
assert.match(sampleConfig, /lineHeight = 1\.12/);
assert.match(sampleConfig, /termName = "xterm-256color"/);


const syncConfig = read('examples/config/sync-folder.toml');
assert.match(syncConfig, /\[sync\]/);
assert.match(syncConfig, /enabled = true/);
assert.match(syncConfig, /Google Drive/);
assert.match(syncConfig, /maxBytes = 1048576/);
assert.match(syncConfig, /\[logging\]/);
assert.match(syncConfig, /fpasoterm-sync\/logs/);

const syncDocsEn = read('docs/sync.en.md');
assert.match(syncDocsEn, /Google Drive API/);
assert.match(syncDocsEn, /OAuth/);
assert.match(syncDocsEn, /fpasoterm --setup-sync/);
assert.match(syncDocsEn, /node \.\\bin\\fpasoterm --setup-sync/);
assert.match(syncDocsEn, /node bin\\fpasoterm --setup-sync/);
assert.match(syncDocsEn, /candidate number/);
assert.match(syncDocsEn, /Sync Channel/);
assert.match(syncDocsEn, /same `path` and the same `channel`/);
assert.match(syncDocsEn, /chromeos-test/);
assert.match(syncDocsEn, /Share with Linux/);
assert.match(syncDocsEn, /\/mnt\/chromeos\/shared\/GoogleDrive\/MyDrive\/shared\/fpasoterm-sync/);
assert.match(syncDocsEn, /\/mnt\/chromeos\/shared\/GoogleDrive\/MyDrive\/temp\/fpasoterm-sync/);
assert.match(syncDocsEn, /renaming `test` to `temp`/);
assert.match(syncDocsEn, /Share with Linux` again/);
assert.match(syncDocsEn, /\/mnt\/shared\/GoogleDrive\/MyDrive\/shared\/fpasoterm-sync/);
assert.match(syncDocsEn, /\/mnt\/chromeos\/GoogleDrive\/MyDrive\/shared\/fpasoterm-sync/);
assert.match(syncDocsEn, /GoogleDrive-<account>/);
assert.match(syncDocsEn, /G:\\My Drive\\fpasoterm-sync/);
assert.match(syncDocsEn, /G:\\マイドライブ\\fpasoterm-sync/);
assert.match(syncDocsEn, /Test-Path 'G:\\My Drive'/);
assert.match(syncDocsEn, /rclone mount/);
assert.doesNotMatch(syncDocsEn, /clipboard\.json/);
assert.match(syncDocsEn, /diagnostics\.json/);
assert.doesNotMatch(syncDocsEn, /Copy Selection/);
assert.doesNotMatch(syncDocsEn, /Pull to Clipboard/);
assert.doesNotMatch(syncDocsEn, /Write Diagnostics/);
assert.match(syncDocsEn, /debounced diagnostics snapshot/);
assert.match(syncDocsEn, /sync\.enabled = false/);
assert.match(syncDocsEn, /not the terminal output log/);
assert.doesNotMatch(syncDocsEn, /titlebar shows a compact `Sync:` status/);
assert.match(syncDocsEn, /Ctrl\+Shift\+L/);
assert.match(syncDocsEn, /Ctrl\+Shift\+S/);
assert.match(syncDocsEn, /Ctrl\+Shift\+P/);
assert.match(syncDocsEn, /Delete All/);
assert.match(syncDocsEn, /opens a selector/);
assert.match(syncDocsEn, /delete the selected stopped log/);
assert.match(syncDocsEn, /press `Ctrl\+Shift\+C`/);
assert.match(syncDocsEn, /same clipboard path/);
assert.match(syncDocsEn, /tmux capture-pane/);
assert.match(syncDocsEn, /Store terminal output logs in the sync folder/);
assert.match(syncDocsEn, /Terminal log directory/);
assert.doesNotMatch(syncDocsEn, /Synced terminal log directory/);
assert.match(syncDocsEn, /G:\\マイドライブ\\fpasoterm-sync\\logs/);
assert.match(syncDocsEn, /That is still a local Windows path/);
assert.match(syncDocsEn, /%USERPROFILE%/);
assert.match(syncDocsEn, /explicit per-OS paths/);
assert.match(syncDocsEn, /log=start/);

const syncDocsJa = read('docs/sync.ja.md');
assert.match(syncDocsJa, /Google Drive API/);
assert.match(syncDocsJa, /OAuth/);
assert.match(syncDocsJa, /fpasoterm --setup-sync/);
assert.match(syncDocsJa, /node \.\\bin\\fpasoterm --setup-sync/);
assert.match(syncDocsJa, /node bin\\fpasoterm --setup-sync/);
assert.match(syncDocsJa, /候補番号/);
assert.match(syncDocsJa, /Sync channel/);
assert.match(syncDocsJa, /同じ `path` と同じ `channel`/);
assert.match(syncDocsJa, /chromeos-test/);
assert.match(syncDocsJa, /Share with Linux/);
assert.match(syncDocsJa, /\/mnt\/chromeos\/shared\/GoogleDrive\/MyDrive\/shared\/fpasoterm-sync/);
assert.match(syncDocsJa, /\/mnt\/chromeos\/shared\/GoogleDrive\/MyDrive\/temp\/fpasoterm-sync/);
assert.match(syncDocsJa, /`test` から `temp` へ rename/);
assert.match(syncDocsJa, /`Linux と共有` を実行/);
assert.match(syncDocsJa, /\/mnt\/shared\/GoogleDrive\/MyDrive\/shared\/fpasoterm-sync/);
assert.match(syncDocsJa, /\/mnt\/chromeos\/GoogleDrive\/MyDrive\/shared\/fpasoterm-sync/);
assert.match(syncDocsJa, /GoogleDrive-<account>/);
assert.match(syncDocsJa, /G:\\My Drive\\fpasoterm-sync/);
assert.match(syncDocsJa, /G:\\マイドライブ\\fpasoterm-sync/);
assert.match(syncDocsJa, /Test-Path 'G:\\My Drive'/);
assert.match(syncDocsJa, /rclone mount/);
assert.doesNotMatch(syncDocsJa, /Copy Selection/);
assert.doesNotMatch(syncDocsJa, /Pull to Clipboard/);
assert.doesNotMatch(syncDocsJa, /Write Diagnostics/);
assert.match(syncDocsJa, /diagnostics snapshot/);
assert.match(syncDocsJa, /sync\.enabled = false/);
assert.match(syncDocsJa, /terminal output log ではありません/);
assert.doesNotMatch(syncDocsJa, /titlebar に `Sync:` status が表示されます/);
assert.doesNotMatch(syncDocsJa, /clipboard\.json/);
assert.match(syncDocsJa, /diagnostics\.json/);
assert.match(syncDocsJa, /Ctrl\+Shift\+L/);
assert.match(syncDocsJa, /Ctrl\+Shift\+S/);
assert.match(syncDocsJa, /Ctrl\+Shift\+P/);
assert.match(syncDocsJa, /Delete All/);
assert.match(syncDocsJa, /一覧から表示対象を選択/);
assert.match(syncDocsJa, /選択した停止済み log/);
assert.match(syncDocsJa, /`Ctrl\+Shift\+C` を押す/);
assert.match(syncDocsJa, /同じ clipboard 経路/);
assert.match(syncDocsJa, /tmux capture-pane/);
assert.match(syncDocsJa, /Store terminal output logs in the sync folder/);
assert.match(syncDocsJa, /Terminal log directory/);
assert.doesNotMatch(syncDocsJa, /Synced terminal log directory/);
assert.match(syncDocsJa, /G:\\マイドライブ\\fpasoterm-sync\\logs/);
assert.match(syncDocsJa, /Windows 上のローカル path/);
assert.match(syncDocsJa, /%USERPROFILE%/);
assert.match(syncDocsJa, /各 OS ごとの実 path/);
assert.match(syncDocsJa, /log=start/);

const runtimeConfig = read('examples/config/runtime-appearance.toml');
assert.match(runtimeConfig, /title = "RUNTIME SAMPLE ACTIVE"/);
assert.match(runtimeConfig, /POSIX shell/);
assert.match(runtimeConfig, /apply-runtime-appearance\.ps1 or \.bat/);
assert.match(runtimeConfig, /titlebarColor = "#d81b60"/);
assert.match(runtimeConfig, /# fontSize = 18/);
assert.match(runtimeConfig, /# width = 1180/);
assert.match(runtimeConfig, /backgroundOpacity = 0\.95/);
assert.match(runtimeConfig, /background = "#32004f"/);
assert.match(runtimeConfig, /foreground = "#fff176"/);
assert.match(runtimeConfig, /cursor = "#00e5ff"/);

const runtimeApplyScript = read('examples/apply-runtime-appearance.sh');
assert.match(runtimeApplyScript, /runtime-appearance\.toml/);
assert.match(runtimeApplyScript, /printf '\\033\]777;config=%s\\a\\r\\n'/);

const runtimeApplyPowerShell = read('examples/apply-runtime-appearance.ps1');
assert.match(runtimeApplyPowerShell, /runtime-appearance\.toml/);
assert.match(runtimeApplyPowerShell, /\[Console\]::Write/);
assert.match(runtimeApplyPowerShell, /`e\]777;config=\$ConfigPath`a`r`n/);

const runtimeApplyBatch = read('examples/apply-runtime-appearance.bat');
assert.match(runtimeApplyBatch, /runtime-appearance\.toml/);
assert.match(runtimeApplyBatch, /powershell\.exe -NoProfile -ExecutionPolicy Bypass/);
assert.match(runtimeApplyBatch, /\[char\]27/);
assert.match(runtimeApplyBatch, /\[char\]7/);

const defaultConfig = read('examples/config/default-appearance.toml');
assert.match(defaultConfig, /title = "fpasoterm"/);
assert.match(defaultConfig, /POSIX shell/);
assert.match(defaultConfig, /apply-default-appearance\.ps1 or \.bat/);
assert.match(defaultConfig, /titlebarColor = "#1565c0"/);
assert.match(defaultConfig, /backgroundOpacity = 0\.8/);
assert.match(defaultConfig, /lineHeight = 1\.12/);
assert.match(defaultConfig, /minimumContrastRatio = 4\.5/);
assert.match(defaultConfig, /rescaleOverlappingGlyphs = true/);
assert.match(defaultConfig, /background = "rgba\(16, 19, 23, 0\.80\)"/);
assert.match(defaultConfig, /foreground = "#e8edf2"/);
assert.match(defaultConfig, /cursor = "#f5d76e"/);
assert.match(defaultConfig, /\[keybindings\]/);
assert.match(defaultConfig, /prefix = "Mod\+Shift"/);
assert.match(defaultConfig, /newWindow = "N"/);

const minimalConfig = read('examples/config/minimal.toml');
assert.match(minimalConfig, /\[keybindings\]/);
assert.match(minimalConfig, /prefix = "Mod\+Shift"/);
assert.match(minimalConfig, /tile = "T"/);

const defaultApplyScript = read('examples/apply-default-appearance.sh');
assert.match(defaultApplyScript, /default-appearance\.toml/);
assert.match(defaultApplyScript, /printf '\\033\]777;config=%s\\a\\r\\n'/);

const defaultApplyPowerShell = read('examples/apply-default-appearance.ps1');
assert.match(defaultApplyPowerShell, /default-appearance\.toml/);
assert.match(defaultApplyPowerShell, /\[Console\]::Write/);
assert.match(defaultApplyPowerShell, /`e\]777;config=\$ConfigPath`a`r`n/);

const defaultApplyBatch = read('examples/apply-default-appearance.bat');
assert.match(defaultApplyBatch, /default-appearance\.toml/);
assert.match(defaultApplyBatch, /powershell\.exe -NoProfile -ExecutionPolicy Bypass/);
assert.match(defaultApplyBatch, /\[char\]27/);
assert.match(defaultApplyBatch, /\[char\]7/);

const pluginTypes = read('docs/fpasoterm-plugin.d.ts');
assert.match(pluginTypes, /fpasotermPluginApi/);
assert.match(pluginTypes, /duplicateWindowMs/);

const renderer = read('src/renderer/renderer.js');
assert.match(renderer, /installTauriApiAdapter/);
assert.match(renderer, /__TAURI__/);
assert.match(renderer, /startWindowDrag/);
assert.match(renderer, /minimizeWindow/);
assert.match(renderer, /toggleMaximizeWindow/);
assert.match(renderer, /newWindow/);
assert.match(renderer, /arrangeWindows/);
assert.match(renderer, /closeAllWindows/);
assert.match(renderer, /confirmCloseAllWindows/);
assert.match(renderer, /confirmCloseAllWindows/);
assert.match(renderer, /resolveCloseAllWindows/);
assert.match(renderer, /Close all running fpasoterm windows/);
assert.match(renderer, /isCloseAllShortcut/);
assert.match(renderer, /isNewWindowShortcut/);
assert.match(renderer, /matchesKeybinding\(event, 'newWindow'\)/);
assert.match(renderer, /getAvailableScreenBounds/);
assert.match(renderer, /matchesKeybinding\(event, 'tile'\)/);
assert.match(renderer, /setWindowMenuOpen/);
assert.match(renderer, /showKeyboardShortcutsHelp/);
assert.match(renderer, /Config: \$\{activeConfigPath/);
assert.match(renderer, /activeConfigPath = String\(runtimeConfig\.configPath/);
assert.match(renderer, /getAppVersion: \(\) => invoke\('app_version'\)/);
assert.match(renderer, /`fpasoterm \$\{version\}`/);
assert.match(renderer, /function matchesKeybinding/);
assert.match(renderer, /function applyKeybindingLabels/);
assert.match(renderer, /function isValidKeybindingPrefix/);
assert.match(renderer, /function isValidFullKeybinding/);
assert.match(renderer, /Invalid prefix/);
assert.match(renderer, /Ctrl\+Alt\+KeyN/);
assert.match(renderer, /keybindingLabel\('menu'\)/);
assert.match(renderer, /terminalLogStatusElement\.hidden = !status\.active/);
assert.doesNotMatch(renderer, /logMenuToggleButton/);
assert.match(renderer, /startWindowResize/);
assert.match(renderer, /startWindowResizeDrag/);
assert.match(renderer, /startResizeDragging/);
assert.match(renderer, /saveWindowBounds/);
assert.match(renderer, /getWindowBounds/);
assert.match(renderer, /setWindowBounds/);
assert.match(renderer, /scheduleWindowStateSave/);
assert.match(renderer, /scheduleFitAndResize/);
assert.match(renderer, /scheduleDeferredFitAndResize/);
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
assert.match(renderer, /sendTerminalInput/);
assert.match(renderer, /lineHeight/);
assert.match(renderer, /minimumContrastRatio/);
assert.match(renderer, /terminalLogStatusElement\.hidden = !status\.active/);
assert.doesNotMatch(renderer, /Logging \(\^L\)/);
assert.match(renderer, /normalizePasteText/);
assert.match(renderer, /pasteClipboardToTerminal/);
assert.match(renderer, /writeClipboardText/);
assert.match(renderer, /writeBrowserClipboardText/);
assert.match(renderer, /copyTerminalSelection/);
assert.match(renderer, /terminalKillButton/);
assert.match(renderer, /killTerminal: \(\) => invoke\('terminal_kill'\)/);
assert.match(renderer, /keybindingLabel\('kill'\)/);
assert.match(renderer, /Kill the running terminal command and keep its shell open/);
assert.match(rustMain, /process_group_leader/);
assert.match(rustMain, /libc::SIGKILL/);
assert.match(rustMain, /kill_windows_shell_descendants/);
assert.match(renderer, /terminalCopyButton/);
assert.match(renderer, /terminalPasteButton/);
assert.match(renderer, /selectedTerminalText/);
assert.match(renderer, /selectedDiagnosticsClipboardText/);
assert.match(renderer, /selectedClipboardText/);
assert.match(renderer, /copyTerminalSelection\(\)\.catch/);
assert.doesNotMatch(renderer, /focusLogMenuItem/);
assert.match(renderer, /focusWindowMenuItem/);
assert.match(renderer, /diagnosticsPanelFocusItems/);
assert.match(renderer, /focusDiagnosticsPanelItem/);
assert.match(renderer, /focusTerminalLogPanel/);
assert.match(renderer, /searchTerminalLogText/);
assert.match(renderer, /scrollDiagnosticsSelectionIntoView/);
assert.match(renderer, /terminalLogSearchState/);
assert.match(renderer, /sameSearch/);
assert.match(renderer, /matches/);
assert.match(renderer, /cursor/);
assert.match(renderer, /searchTerminalLogText\(1\)/);
assert.match(renderer, /searchTerminalLogText\(-1\)/);
assert.match(renderer, /terminalLogSearchStatusElement\.textContent = `\$\{terminalLogSearchState\.cursor \+ 1\}\/\$\{terminalLogSearchState\.matches\.length\}`/);
assert.match(renderer, /restoreLogPanelFocus/);
assert.match(renderer, /terminalLogSelectElement\?\.options\?\.length > 0/);
assert.match(renderer, /options = \{\}/);
assert.match(renderer, /options\.repeat/);
assert.match(renderer, /afterNextPaint\(\)\.then/);
assert.match(renderer, /diagnosticsPanel\.focus\(\{ preventScroll: true \}\)/);
assert.match(renderer, /\[0, 50, 120, 240\]/);
assert.match(renderer, /confirmTerminalLogAction/);
assert.match(renderer, /resolveTerminalLogConfirm/);
assert.match(renderer, /terminalLogConfirmResolver/);
assert.match(renderer, /closeDiagnosticsButton/);
assert.match(renderer, /toggleTerminalOutputLog/);
assert.match(renderer, /showTerminalOutputLogFromMenu/);
assert.match(renderer, /focusTarget\.focus\(\)/);
assert.match(renderer, /event\.key === 'ArrowDown'/);
assert.match(renderer, /event\.key === 'ArrowUp'/);
assert.match(renderer, /event\.key === 'Escape'/);
assert.match(renderer, /event\.key === 'Tab'/);
assert.match(renderer, /event\.shiftKey \? -1 : 1/);
assert.match(renderer, /event\.key !== 'Enter'/);
assert.match(renderer, /key\.toLowerCase\(\) === 'j'/);
assert.match(renderer, /key\.toLowerCase\(\) === 'k'/);
assert.match(renderer, /matchesKeybinding\(event, 'logMenu'\)/);
assert.match(renderer, /matchesKeybinding\(event, 'logToggle'\)/);
assert.match(renderer, /matchesKeybinding\(event, 'logShow'\)/);
assert.doesNotMatch(renderer, /document\.execCommand\('copy'\)/);
assert.match(renderer, /event\.clipboardData\?\.setData\('text\/plain', text\)/);
assert.match(renderer, /event\.clipboardData\?\.setData\('text', text\)/);
assert.match(renderer, /navigator\.clipboard\.write\(\[item\]\)/);
assert.match(renderer, /navigator\.clipboard\.writeText\(text\)/);
assert.match(renderer, /term\.getSelection\(\)/);
assert.match(renderer, /term\.hasSelection/);
assert.match(renderer, /selection copied/);
assert.match(renderer, /selection copied via copy event/);
assert.match(renderer, /browser clipboard write failed/);
assert.match(renderer, /backend clipboard write failed/);
assert.doesNotMatch(renderer, /selectedDiagnosticsText/);
assert.match(renderer, /selectionStart/);
assert.match(renderer, /selectionEnd/);
assert.match(renderer, /installTerminalPasteHandlers/);
assert.match(renderer, /readClipboard/);
assert.match(renderer, /writeClipboard/);
assert.match(renderer, /decodeOsc52Text/);
assert.match(renderer, /applyOsc52Clipboard/);
assert.match(renderer, /OSC 52 clipboard wrote/);
assert.match(renderer, /contextmenu/);
assert.match(renderer, /terminal context paste failed/);
assert.match(renderer, /terminal menu copy failed/);
assert.match(renderer, /terminal menu paste failed/);
assert.doesNotMatch(renderer, /copyDiagnosticsButton/);
assert.doesNotMatch(renderer, /diagnostics copy failed/);
assert.match(renderer, /matchesKeybinding\(event, 'paste'\)/);
assert.match(renderer, /matchesKeybinding\(event, 'copy'\)/);
assert.doesNotMatch(renderer, /setPointerCapture/);
assert.doesNotMatch(renderer, /syncStatusElement/);
assert.match(renderer, /scheduleSyncDiagnosticsWrite/);
assert.match(renderer, /writeDiagnosticsSnapshot/);
assert.doesNotMatch(renderer, /Sync: Ready/);
assert.doesNotMatch(renderer, /Sync: Writing/);
assert.doesNotMatch(renderer, /Sync: Updated/);
assert.doesNotMatch(renderer, /Sync: Empty/);
assert.doesNotMatch(renderer, /Sync: Error/);
assert.doesNotMatch(renderer, /Sync: Synced/);
assert.doesNotMatch(renderer, /syncMenuToggleButton/);
assert.doesNotMatch(renderer, /setSyncMenuOpen/);
assert.doesNotMatch(renderer, /closeSyncMenu/);
assert.doesNotMatch(renderer, /pulled to OS clipboard/);
assert.match(renderer, /correctCompositionData/);
assert.match(renderer, /installCompositionDuplicateGuard/);
assert.match(renderer, /compositionupdate/);
assert.match(renderer, /repeatedTextWindowMs/);
assert.match(renderer, /fpasotermPluginApi/);
assert.match(renderer, /closeWindowButton/);
assert.match(renderer, /minimizeWindowButton/);
assert.match(renderer, /maximizeWindowButton/);
assert.match(renderer, /closeWindow\(\)/);
assert.match(renderer, /applyWindowAppearance/);
assert.match(renderer, /applyTerminalAppearance/);
assert.match(renderer, /normalizeOpacity/);
assert.match(renderer, /colorWithOpacity/);
assert.match(renderer, /terminalThemeWithOpacity/);
assert.match(renderer, /applyRuntimeConfig/);
assert.match(renderer, /applyRuntimeConfigPath/);
assert.match(renderer, /await afterNextPaint\(\);\s*fitAndResize\(\);/s);
assert.match(renderer, /applyConfigPath/);
assert.match(renderer, /setRuntimeWindowTitle/);
assert.match(renderer, /titleLocked/);
assert.match(renderer, /ignored shell title change while title is locked/);
assert.match(renderer, /setRuntimeWindowTitle\(value, \{ force: true \}\)/);
assert.match(renderer, /setRuntimeTitlebarColor/);
assert.match(renderer, /applyFpasotermOsc/);
assert.match(renderer, /processRuntimeOsc/);
assert.doesNotMatch(renderer, /syncWriteClipboard/);
assert.doesNotMatch(renderer, /syncReadClipboard/);
assert.match(renderer, /syncWriteDiagnostics/);
assert.match(renderer, /installSyncControls/);
assert.doesNotMatch(renderer, removedCamelHttpUiPattern);
assert.doesNotMatch(renderer, /web console/);
assert.match(renderer, /startTerminalLog/);
assert.match(renderer, /stopTerminalLog/);
assert.match(renderer, /terminalLogStatus/);
assert.doesNotMatch(renderer, /logMenuToggleButton/);
assert.doesNotMatch(renderer, /setLogMenuOpen/);
assert.doesNotMatch(renderer, /closeLogMenu/);
assert.match(renderer, /terminalLogToggleButton/);
assert.match(renderer, /terminalLogShowButton/);
assert.doesNotMatch(renderer, /terminalLogClearButton/);
assert.match(renderer, /normalizeJapaneseTerminalText/);
assert.match(renderer, /normalize\('NFC'\)/);
assert.doesNotMatch(renderer, /normalize\('NFKC'\)/);
assert.match(renderer, /terminalLogSelectElement/);
assert.match(renderer, /terminalLogDeleteSelectedButton/);
assert.match(renderer, /showTerminalLog/);
assert.match(renderer, /listTerminalLogs/);
assert.match(renderer, /deleteTerminalLog/);
assert.match(renderer, /clearTerminalLog/);
assert.match(renderer, /showTerminalOutputLog/);
assert.match(renderer, /refreshTerminalLogList/);
assert.match(renderer, /deleteSelectedTerminalOutputLog/);
assert.match(renderer, /clearTerminalOutputLog/);
assert.match(renderer, /normalize\('NFC'\)/);
assert.match(renderer, /Clear all terminal output logs/);
assert.match(renderer, /delete all stopped terminal-\*\.log files/);
assert.match(renderer, /This cannot be undone/);
assert.doesNotMatch(renderer, /window\.confirm/);
assert.match(renderer, /keybindingLabel\('logToggle'\)/);
assert.match(renderer, /keybindingLabel\('logShow'\)/);
assert.match(renderer, /closeDiagnosticsButton/);
assert.match(renderer, /startTerminalOutputLog/);
assert.match(renderer, /stopTerminalOutputLog/);
assert.match(renderer, /getSelection/);
assert.match(renderer, /onTitleChange/);
assert.match(renderer, /ImageAddon\.ImageAddon/);
assert.match(renderer, /kittySupport/);
assert.match(renderer, /kittySizeLimit/);
assert.match(renderer, /function terminalPtySize/);
assert.match(renderer, /pixelWidth/);
assert.match(renderer, /pixelHeight/);
assert.match(renderer, /onImageAdded/);
assert.match(renderer, /interrupt fallback/);
assert.match(renderer, /sendTerminalInput\('\\x03'/);
assert.match(renderer, /Let the native WebView create a paste event first/);
assert.match(renderer, /terminalPasteFallbackTimer/);
assert.match(renderer, /isNonTerminalEditableControl/);
assert.doesNotMatch(renderer, /materializeKittyFileTransfers/);
assert.doesNotMatch(renderer, /readKittyImageFile/);
assert.doesNotMatch(renderer, /transfer !== 'f' && transfer !== 't'/);
assert.match(rustMain, /pixel_width/);
assert.match(rustMain, /pixel_height/);
assert.doesNotMatch(rustMain, /kitty_image_file_read/);
assert.doesNotMatch(rustMain, /KITTY_IMAGE_FILE_LIMIT_BYTES/);
assert.match(renderer, /terminal_broadcast/);
assert.match(renderer, /openTerminalBroadcastDialog/);
assert.match(renderer, /keybindingLabel\('broadcast'\)/);
assert.match(renderer, /terminalBroadcastTargets/);
assert.match(renderer, /renderTerminalBroadcastTargets/);
assert.match(renderer, /targetInstanceIds/);
assert.match(renderer, /\\x1b\\\]\(777\|52\);/);
assert.match(renderer, /key === 'config'/);
assert.match(renderer, /key === 'opacity'/);
assert.match(renderer, /CSS\.supports\('color'/);
assert.match(renderer, /titlebarColor/);
assert.match(renderer, /--titlebar-background/);

const styles = read('src/renderer/styles.css');
assert.match(styles, /xterm-image-layer-top/);
assert.match(styles, /#drag-region/);
assert.doesNotMatch(styles, removedKebabHttpUiPattern);
assert.match(styles, /--titlebar-background: #1565c0/);
assert.match(styles, /background: var\(--titlebar-background\)/);
assert.match(styles, /-webkit-app-region: drag/);
assert.match(styles, /app-region: drag/);
assert.match(styles, /--titlebar-height: 34px/);
assert.match(styles, /grid-template-rows: var\(--titlebar-height\) minmax\(0, 1fr\)/);
assert.match(styles, /height: var\(--titlebar-height\)/);
assert.match(styles, /pointer-events: none/);
assert.match(styles, /#window-controls/);
assert.match(styles, /#window-title[\s\S]*flex: 1 1 auto/);
assert.match(styles, /#terminal-log-status/);
assert.match(styles, /#terminal-log-status\[hidden\]/);
assert.doesNotMatch(styles, /#sync-menu/);
assert.doesNotMatch(styles, /#sync-status/);
assert.doesNotMatch(styles, /#sync-menu-items/);
assert.doesNotMatch(styles, /#log-menu/);
assert.match(styles, /#terminal-log-search/);
assert.match(styles, /#terminal-log-search-next/);
assert.match(styles, /#terminal-log-search-status/);
assert.match(styles, /#terminal-log-confirm/);
assert.match(styles, /\.terminal-log-confirm-card/);
assert.match(styles, /#terminal-log-confirm-ok/);
assert.match(styles, /#diagnostics-panel button:focus/);
assert.match(styles, /#diagnostics-panel select:focus-visible/);
assert.match(styles, /outline: 3px solid #f5d76e/);
assert.match(styles, /box-shadow: 0 0 0 2px/);
assert.match(styles, /#diagnostics::selection/);
assert.match(styles, /padding: 0 2px 8px/);
assert.match(styles, /\.resize-edge-bottom\s*\{[^}]*height: 4px/s);
assert.match(styles, /\.resize-edge-bottom\s*\{[^}]*left: 96px/s);
assert.match(styles, /\.resize-edge-left\s*\{[^}]*bottom: 64px/s);
assert.match(styles, /\.resize-corner-bottom-left\s*\{[^}]*display: none/s);
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
assert.match(config, /title: 'fpasoterm'/);
assert.match(config, /titlebarColor: '#1565c0'/);
assert.match(config, /titleLocked: true/);
assert.match(config, /backgroundOpacity: 0\.8/);
assert.match(config, /lineHeight: 1\.12/);
assert.match(config, /minimumContrastRatio: 4\.5/);
assert.match(config, /rescaleOverlappingGlyphs: true/);
assert.match(config, /BIZ UDGothic/);
assert.match(config, /半角カタカナ|half-width kana/);
assert.match(config, /termName: 'xterm-256color'/);
assert.match(config, /shell: ''/);
assert.match(config, /keybindings:/);
assert.match(config, /prefix: 'Mod\+Shift'/);
assert.match(config, /Ctrl\+Alt\+KeyN/);
assert.match(config, /enabled: false/);
assert.match(config, /kittySupport: false/);
assert.match(config, /function writableConfigDefaults/);
assert.match(config, /sixelSupport: false/);
assert.match(config, /commandTtlSeconds: 60/);
assert.match(config, /sync:/);
assert.match(config, /provider: 'folder'/);
assert.match(config, /logging:/);
assert.match(config, /autoStart: false/);
assert.match(config, /maxBytes: 10485760/);
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

const launcher = read('bin/fpasoterm');
assert.match(launcher, /--setup-sync/);
assert.match(launcher, /--version/);
assert.match(launcher, /printVersion/);
assert.doesNotMatch(launcher, removedKebabHttpUiPattern);
assert.doesNotMatch(launcher, removedHttpUiEnvPattern);
assert.match(launcher, /setupSync/);
assert.match(launcher, /expandPathVariables/);
assert.match(launcher, /%\(\[\^%\]\+\)%/);
assert.match(launcher, /googleDriveCandidates/);
assert.match(launcher, /\/mnt\/chromeos\/shared\/GoogleDrive\/MyDrive/);
assert.match(launcher, /\/mnt\/shared\/GoogleDrive\/MyDrive/);
assert.match(launcher, /\/mnt\/chromeos\/GoogleDrive\/MyDrive/);
assert.match(launcher, /writableDriveCandidates/);
assert.match(launcher, /canWriteDirectory/);
assert.match(launcher, /syncPathCandidates/);
assert.match(launcher, /candidate number/);
assert.match(launcher, /Use the same sync channel on devices that should share data/);
assert.match(launcher, /Press Enter to keep "default"/);
assert.match(launcher, /Terminal output logs stay local by default/);
assert.match(launcher, /Answer y only when you want readable terminal output logs stored in the selected sync folder/);
assert.match(launcher, /Terminal log directory/);
assert.doesNotMatch(launcher, /Synced terminal log directory/);
assert.match(launcher, /G:\\\\My Drive/);
assert.match(launcher, /マイドライブ/);
assert.match(launcher, /DEFGHIJKLMNOPQRSTUVWXYZ/);
assert.match(launcher, /GoogleDrive-/);
assert.match(launcher, /G:\\\\My Drive/);
assert.match(launcher, /readline\.createInterface/);
assert.match(launcher, /writeUserConfig/);

const desktop = read('extra/linux/io.github.oyoguhito.fpasoterm.desktop');
assert.match(desktop, /^Name=fpasoterm$/m);
assert.match(desktop, /^Icon=io\.github\.oyoguhito\.fpasoterm$/m);
assert.match(desktop, /^StartupWMClass=fpasoterm$/m);
assert.match(read('README.md'), /StartupWMClass=fpasoterm/);
assert.match(read('INSTALL.md'), /StartupWMClass=fpasoterm/);
assert.match(read('INSTALL.ja.md'), /StartupWMClass=fpasoterm/);
assert.match(read('INSTALL.ja.md'), /Linux Desktop Entry/);
assert.match(read('README.ja.md'), /docs\/config\.ja\.md/);

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
