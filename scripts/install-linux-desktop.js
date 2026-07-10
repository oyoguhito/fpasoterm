const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
const binHome = process.env.XDG_BIN_HOME || path.join(os.homedir(), '.local', 'bin');
const applicationsDir = path.join(dataHome, 'applications');
const iconsDir = path.join(dataHome, 'icons', 'hicolor');
const iconSizes = [16, 32, 48, 64, 128, 192, 256, 512];

// Copies one desktop or icon file, creating the target directory first.
function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`${source} -> ${target}`);
}

// Runs optional desktop cache refresh commands when they exist on the host.
function runOptional(command, args) {
  const result = childProcess.spawnSync(command, args, { stdio: 'inherit' });
  if (result.error && result.error.code !== 'ENOENT') {
    throw result.error;
  }
}

// Removes legacy files created by older fpasoterm versions.
function removeFile(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { force: true });
    console.log(`removed old file: ${target}`);
  }
}

// Quotes paths safely for the generated shell wrapper.
function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

// Installs the local fpasoterm command wrapper into the user's bin directory.
function installCommand() {
  fs.mkdirSync(binHome, { recursive: true });
  const commandPath = path.join(binHome, 'fpasoterm');
  const script = `#!/bin/sh
set -eu

APP_ROOT=${shellQuote(root)}
cd "$APP_ROOT"

if command -v node >/dev/null 2>&1; then
  exec node "$APP_ROOT/bin/fpasoterm" "$@"
fi

if command -v mise >/dev/null 2>&1; then
  exec mise exec node -- node "$APP_ROOT/bin/fpasoterm" "$@"
fi

echo "node is not available. Install Node.js or enable mise's Node toolchain." >&2
exit 127
`;
  fs.writeFileSync(commandPath, script, { mode: 0o755 });
  fs.chmodSync(commandPath, 0o755);
  console.log(`fpasoterm command -> ${commandPath}`);
}

installCommand();

copyFile(
  path.join(root, 'extra', 'linux', 'io.github.oyoguhito.fpasoterm.desktop'),
  path.join(applicationsDir, 'io.github.oyoguhito.fpasoterm.desktop'),
);
removeFile(path.join(applicationsDir, 'io.github.oyoguhito.FpasoTerm.desktop'));

for (const size of iconSizes) {
  copyFile(
    path.join(root, 'extra', 'linux', 'icons', 'hicolor', `${size}x${size}`, 'apps', 'fpasoterm.png'),
    path.join(iconsDir, `${size}x${size}`, 'apps', 'fpasoterm.png'),
  );
}

runOptional('update-desktop-database', [applicationsDir]);
runOptional('gtk-update-icon-cache', ['-q', iconsDir]);
