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

// Builds a current local Tauri binary so launcher icon starts do not fall back
// to `tauri dev`, which runs Cargo watch and looks like a failed GUI launch.
function buildLocalBinary() {
  if (process.env.FPASOTERM_SKIP_DESKTOP_BUILD === '1') {
    console.log('skipping local Tauri build because FPASOTERM_SKIP_DESKTOP_BUILD=1');
    return;
  }

  const result = childProcess.spawnSync(
    'cargo',
    ['build', '--manifest-path', path.join(root, 'src-tauri', 'Cargo.toml')],
    { stdio: 'inherit' },
  );
  if (result.error && result.error.code === 'ENOENT') {
    console.warn('cargo is not available; launcher may fall back to Tauri dev until a binary is built');
    return;
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`cargo build failed with exit code ${result.status}`);
  }
}

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

// Returns the Node.js executable used to run this installer when it is stable.
function currentNodePath() {
  return path.isAbsolute(process.execPath) && fs.existsSync(process.execPath) ? process.execPath : '';
}

// Formats the Exec command path for a desktop entry. ChromeOS Linux launchers
// are more reliable with a plain absolute path when the wrapper path has no
// spaces.
function desktopExec(value) {
  if (/[\s"'\\]/.test(value)) {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
  }
  return value;
}

// Installs a desktop entry that points at the absolute wrapper path.
function installDesktopEntry(commandPath) {
  const source = path.join(root, 'extra', 'linux', 'io.github.oyoguhito.fpasoterm.desktop');
  const target = path.join(applicationsDir, 'io.github.oyoguhito.fpasoterm.desktop');
  const desktop = fs.readFileSync(source, 'utf8')
    .replace(/^Exec=.*$/m, `Exec=${desktopExec(commandPath)}`)
    .replace(/^Icon=.*$/m, 'Icon=fpasoterm');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, desktop);
  console.log(`${source} -> ${target}`);
}

// Installs the local fpasoterm command wrapper into the user's bin directory.
function installCommand() {
  fs.mkdirSync(binHome, { recursive: true });
  const commandPath = path.join(binHome, 'fpasoterm');
  const nodePath = currentNodePath();
const script = `#!/bin/sh
set -eu

APP_ROOT=${shellQuote(root)}
INSTALL_NODE=${nodePath ? shellQuote(nodePath) : "''"}
LOG_DIR="\${XDG_CACHE_HOME:-$HOME/.cache}/fpasoterm"
LOG_FILE="$LOG_DIR/launcher.log"
PATH="$HOME/.cargo/bin:$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"
FPASOTERM_LAUNCHER_LOG="$LOG_FILE"
export PATH FPASOTERM_LAUNCHER_LOG
mkdir -p "$LOG_DIR" 2>/dev/null || true
{
  printf '%s\\n' "--- fpasoterm launcher $(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || true) ---"
  printf 'argv=%s\\n' "$*"
  printf 'pwd=%s\\n' "$(pwd 2>/dev/null || true)"
  printf 'PATH=%s\\n' "\${PATH:-}"
  printf 'DISPLAY=%s\\n' "\${DISPLAY:-}"
  printf 'WAYLAND_DISPLAY=%s\\n' "\${WAYLAND_DISPLAY:-}"
  printf 'XDG_RUNTIME_DIR=%s\\n' "\${XDG_RUNTIME_DIR:-}"
  printf 'APP_ROOT=%s\\n' "$APP_ROOT"
  printf 'INSTALL_NODE=%s\\n' "$INSTALL_NODE"
} >>"$LOG_FILE" 2>/dev/null || true
cd "$APP_ROOT"

if [ -n "$INSTALL_NODE" ] && [ -x "$INSTALL_NODE" ]; then
  printf 'exec=%s\\n' "$INSTALL_NODE" >>"$LOG_FILE" 2>/dev/null || true
  exec "$INSTALL_NODE" "$APP_ROOT/bin/fpasoterm" "$@"
fi

if command -v node >/dev/null 2>&1; then
  printf 'exec=%s\\n' "$(command -v node)" >>"$LOG_FILE" 2>/dev/null || true
  exec node "$APP_ROOT/bin/fpasoterm" "$@"
fi

for candidate in /usr/bin/node /usr/local/bin/node "$HOME/.local/bin/node"; do
  if [ -x "$candidate" ]; then
    printf 'exec=%s\\n' "$candidate" >>"$LOG_FILE" 2>/dev/null || true
    exec "$candidate" "$APP_ROOT/bin/fpasoterm" "$@"
  fi
done

echo "node is not available. Install Node.js and run npm run update:desktop again." >&2
printf 'error=node is not available\\n' >>"$LOG_FILE" 2>/dev/null || true
exit 127
`;
  fs.writeFileSync(commandPath, script, { mode: 0o755 });
  fs.chmodSync(commandPath, 0o755);
  console.log(`fpasoterm command -> ${commandPath}`);
  return commandPath;
}

buildLocalBinary();

const commandPath = installCommand();

installDesktopEntry(commandPath);
removeFile(path.join(applicationsDir, 'io.github.oyoguhito.FpasoTerm.desktop'));

for (const size of iconSizes) {
  copyFile(
    path.join(root, 'extra', 'linux', 'icons', 'hicolor', `${size}x${size}`, 'apps', 'fpasoterm.png'),
    path.join(iconsDir, `${size}x${size}`, 'apps', 'fpasoterm.png'),
  );
}

runOptional('update-desktop-database', [applicationsDir]);
runOptional('gtk-update-icon-cache', ['-q', iconsDir]);
