const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
const binHome = process.env.XDG_BIN_HOME || path.join(os.homedir(), '.local', 'bin');
const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const cacheHome = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
const applicationsDir = path.join(dataHome, 'applications');
const iconsDir = path.join(dataHome, 'icons', 'hicolor');
const appDataDir = path.join(dataHome, 'io.github.oyoguhito.fpasoterm');
const configDir = path.join(configHome, 'fpasoterm');
const cacheDir = path.join(cacheHome, 'fpasoterm');
const iconSizes = [16, 32, 48, 64, 128, 192, 256, 512];

// Removes a file if it was installed by fpasoterm or a legacy version.
function removeFile(target) {
  if (!fs.existsSync(target)) {
    console.log(`not found: ${target}`);
    return;
  }

  fs.rmSync(target, { force: true });
  console.log(`removed: ${target}`);
}

// Removes a directory only when no other application files remain inside it.
function removeEmptyDir(target) {
  try {
    fs.rmdirSync(target);
    console.log(`removed empty directory: ${target}`);
  } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) {
      throw error;
    }
  }
}

// Removes a private fpasoterm directory such as config, cache, or WebKit data.
function removeDir(target) {
  if (!fs.existsSync(target)) {
    console.log(`not found: ${target}`);
    return;
  }

  fs.rmSync(target, { recursive: true, force: true });
  console.log(`removed: ${target}`);
}

// Checks whether the applications directory still contains desktop entries.
function hasDesktopEntries(target) {
  try {
    return fs.readdirSync(target).some((entry) => entry.endsWith('.desktop'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

// Runs optional desktop cache refresh commands when available.
function runOptional(command, args) {
  const result = childProcess.spawnSync(command, args, { stdio: 'inherit' });
  if (result.error && result.error.code !== 'ENOENT') {
    throw result.error;
  }
}

removeFile(path.join(binHome, 'fpasoterm'));
removeFile(path.join(applicationsDir, 'io.github.oyoguhito.fpasoterm.desktop'));
removeFile(path.join(applicationsDir, 'io.github.oyoguhito.FpasoTerm.desktop'));

for (const size of iconSizes) {
  const iconDir = path.join(iconsDir, `${size}x${size}`, 'apps');
  removeFile(path.join(iconDir, 'fpasoterm.png'));
  removeEmptyDir(iconDir);
  removeEmptyDir(path.dirname(iconDir));
}

runOptional('update-desktop-database', [applicationsDir]);
runOptional('gtk-update-icon-cache', ['-q', iconsDir]);

removeDir(configDir);
removeDir(cacheDir);
removeDir(appDataDir);

if (!hasDesktopEntries(applicationsDir)) {
  removeFile(path.join(applicationsDir, 'mimeinfo.cache'));
}

removeEmptyDir(applicationsDir);
removeEmptyDir(iconsDir);
