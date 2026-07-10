const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artifactsDir = path.join(root, 'artifacts');
const npmCacheDir = path.join(artifactsDir, '.npm-cache');
const packageJson = require(path.join(root, 'package.json'));
const version = packageJson.version;

// Runs packaging commands from the repository root with an artifact-local npm cache.
function run(command, args, options = {}) {
  childProcess.execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
    ...options,
  });
}

fs.rmSync(artifactsDir, { recursive: true, force: true });
fs.mkdirSync(artifactsDir, { recursive: true });

run('npm', ['pack', '--pack-destination', artifactsDir]);

const portableName = `fpasoterm-${version}-source-portable`;
const portableRoot = path.join(artifactsDir, portableName);
fs.mkdirSync(portableRoot, { recursive: true });

for (const entry of [
  'bin',
  'docs',
  'examples',
  'extra',
  'scripts',
  'src',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'INSTALL.md',
  'README.md',
  'LICENSE',
  'package.json',
  'package-lock.json',
]) {
  fs.cpSync(path.join(root, entry), path.join(portableRoot, entry), {
    recursive: true,
  });
}

run('tar', ['-czf', `${portableName}.tar.gz`, portableName], {
  cwd: artifactsDir,
});

fs.rmSync(portableRoot, { recursive: true, force: true });
fs.rmSync(npmCacheDir, { recursive: true, force: true });
console.log(`Artifacts written to ${artifactsDir}`);
