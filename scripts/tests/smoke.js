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
assert.equal(packageJson.version, '1.2.2');
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
  'docs/config.en.md',
  'docs/config.ja.md',
  'docs/fpasoterm-plugin.d.ts',
  'docs/known-issues.en.md',
  'docs/known-issues.ja.md',
  'docs/pr-review.en.md',
  'docs/pr-review.ja.md',
  'docs/spec.en.md',
  'docs/spec.ja.md',
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
assert.match(bin, /--self-update/);
assert.match(bin, /--self-update-checkout/);
assert.match(bin, /--update-desktop/);
assert.match(bin, /--shell/);
assert.match(bin, /--command/);
assert.match(bin, /--title/);
assert.match(bin, /--titlebar-color/);
assert.match(bin, /--reset-window-state/);
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
assert.match(bin, /@tauri-apps/);
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
assert.match(bin, /\.fpasoterm-normal-build\.json/);
assert.match(bin, /cargo', \['build', '--manifest-path'/);
assert.match(bin, /options\.dev \? 'tauri-dev' : 'binary'/);
assert.match(bin, /options\.dev \? undefined : await buildTauriBinary\(options\)/);
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
assert.match(generatedExample, /shell = ""/);
assert.equal(windowStatePath(), path.join(stateTestDir, 'fpasoterm', 'User', 'window-state.json'));
assert.equal(stateConfig.config.window.width, 1200);
assert.equal(stateConfig.config.window.height, 900);
assert.equal(stateConfig.config.terminal.shell, '');
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
assert.doesNotMatch(installDesktop, /mise exec node/);
assert.match(installDesktop, /io\.github\.oyoguhito\.FpasoTerm\.desktop/);

const uninstallDesktop = read('scripts/uninstall-linux-desktop.js');
assert.match(uninstallDesktop, /XDG_BIN_HOME/);
assert.match(uninstallDesktop, /removed:/);
assert.match(uninstallDesktop, /io\.github\.oyoguhito\.fpasoterm\.desktop/);
assert.match(uninstallDesktop, /io\.github\.oyoguhito\.FpasoTerm\.desktop/);
assert.match(uninstallDesktop, /fpasoterm\.png/);
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
assert.match(cargoToml, /tauri =/);
assert.match(cargoToml, /macos-private-api/);
assert.match(cargoToml, /portable-pty/);
assert.match(cargoToml, /toml =/);
assert.match(cargoToml, /windows-sys/);
assert.match(cargoToml, /Win32_System_Console/);

const tauriCapabilities = read('src-tauri/capabilities/default.json');
assert.match(tauriCapabilities, /core:event:allow-listen/);
assert.match(tauriCapabilities, /core:window:allow-start-resize-dragging/);
assert.match(tauriCapabilities, /"windows": \["main"\]/);

const rustMain = read('src-tauri/src/main.rs');
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
assert.match(rustMain, /print_cli_text\(HELP_TEXT\)/);
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
assert.match(rustMain, /\.minimize\(\)/);
assert.match(rustMain, /\.maximize\(\)/);
assert.match(rustMain, /\.unmaximize\(\)/);
assert.match(rustMain, /set_title/);
assert.match(rustMain, /set_window_icon/);
assert.match(rustMain, /default_window_icon/);
assert.match(rustMain, /\.set_icon\(icon\.clone\(\)\)/);
assert.match(rustMain, /PhysicalPosition/);
assert.match(rustMain, /restoring window size/);
assert.match(rustMain, /PhysicalSize::new\(config\.config\.window\.width/);
assert.match(rustMain, /schedule_startup_size_restore/);
assert.match(rustMain, /Duration::from_millis\(650\)/);
assert.match(rustMain, /startup window size restore requested/);
assert.match(rustMain, /WindowEvent::Resized\(size\)/);
assert.match(rustMain, /save_window_size\(\*size/);
assert.doesNotMatch(rustMain, /WindowEvent::Moved/);
assert.doesNotMatch(rustMain, /WindowEvent::Destroyed/);
assert.match(rustMain, /config_get/);
assert.match(rustMain, /WEBKIT_DISABLE_DMABUF_RENDERER/);
assert.match(rustMain, /FPASOTERM_RUNTIME_CONFIG_JSON/);

const indexHtml = read('src/renderer/index.html');
assert.match(indexHtml, /id="drag-region"/);
assert.match(indexHtml, /id="window-title"/);
assert.match(indexHtml, /id="window-controls"/);
assert.match(indexHtml, /id="minimize-window"/);
assert.match(indexHtml, /id="maximize-window"/);
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
assert.match(readme, /docs\/pr-review\.en\.md/);
assert.match(readme, /docs\/pr-review\.ja\.md/);
assert.match(readme, /examples\/plugins/);
assert.match(readme, /--shell/);
assert.match(readme, /PowerShell\\7\\pwsh\.exe/);
assert.match(readme, /PowerShell 7 \(`pwsh\.exe`\) by default/);
assert.match(readme, /fpasoterm executable directory at the[\s\S]*front of `Path`/);
assert.match(readme, /multiple fpasoterm windows can be opened/);
assert.match(readme, /removes fpasoterm-specific directories from the[\s\S]*current user's `Path`/);
assert.match(readme, /By default, fpasoterm keeps its configured title/);
assert.match(readme, /--command/);
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
assert.match(configDocsEn, /shell = ""/);
assert.match(configDocsEn, /pwsh\.exe/);
assert.match(configDocsEn, /PowerShell 7 \(`pwsh\.exe`\) is the default/);
assert.match(configDocsEn, /PowerShell\\7\\pwsh\.exe/);
assert.match(configDocsEn, /fpasoterm executable directory at the front of `Path`/);
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
assert.match(configDocsJa, /shell = ""/);
assert.match(configDocsJa, /pwsh\.exe/);
assert.match(configDocsJa, /PowerShell 7 \(`pwsh\.exe`\) が利用可能な場合に既定 shell/);
assert.match(configDocsJa, /PowerShell\\7\\pwsh\.exe/);
assert.match(configDocsJa, /fpasoterm の実行ファイルがあるディレクトリを追加/);
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
assert.match(sampleConfig, /termName = "xterm-256color"/);

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
assert.match(defaultConfig, /background = "rgba\(16, 19, 23, 0\.80\)"/);
assert.match(defaultConfig, /foreground = "#e8edf2"/);
assert.match(defaultConfig, /cursor = "#f5d76e"/);

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
assert.doesNotMatch(renderer, /setPointerCapture/);
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
assert.match(renderer, /onTitleChange/);
assert.match(renderer, /\\x1b\\\]777;/);
assert.match(renderer, /key === 'config'/);
assert.match(renderer, /key === 'opacity'/);
assert.match(renderer, /CSS\.supports\('color'/);
assert.match(renderer, /titlebarColor/);
assert.match(renderer, /--titlebar-background/);

const styles = read('src/renderer/styles.css');
assert.match(styles, /#drag-region/);
assert.match(styles, /--titlebar-background: #1565c0/);
assert.match(styles, /background: var\(--titlebar-background\)/);
assert.match(styles, /-webkit-app-region: drag/);
assert.match(styles, /app-region: drag/);
assert.match(styles, /--titlebar-height: 34px/);
assert.match(styles, /grid-template-rows: var\(--titlebar-height\) minmax\(0, 1fr\)/);
assert.match(styles, /height: var\(--titlebar-height\)/);
assert.match(styles, /pointer-events: none/);
assert.match(styles, /#window-controls/);
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
assert.match(config, /termName: 'xterm-256color'/);
assert.match(config, /shell: ''/);
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
