const childProcess = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

// Runs the platform-specific uninstaller used by the npm script entry point.
function main() {
  if (process.platform === 'win32') {
    childProcess.execFileSync(process.execPath, [path.join(root, 'scripts', 'uninstall-windows-path.js')], {
      stdio: 'inherit',
    });
    return;
  }

  childProcess.execFileSync(process.execPath, [path.join(root, 'scripts', 'uninstall-linux-desktop.js')], {
    stdio: 'inherit',
  });
}

main();
