const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artifactsDir = path.join(root, 'artifacts');
const npmCacheDir = path.join(artifactsDir, '.npm-cache');
const packageJson = require(path.join(root, 'package.json'));
const version = packageJson.version;
const args = new Set(process.argv.slice(2));
const sourceOnly = args.has('--source-only');
const bundlesOnly = args.has('--bundles-only');
const artifactLabel = process.env.FPASOTERM_ARTIFACT_LABEL || '';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
if (sourceOnly && bundlesOnly) {
  throw new Error('Use only one of --source-only or --bundles-only');
}
const packageEntries = [
  'bin',
  'docs',
  'examples',
  'extra',
  'scripts',
  'src',
  'src-tauri',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'INSTALL.md',
  'README.md',
  'LICENSE',
  'package.json',
  'package-lock.json',
];

// Runs packaging commands from the repository root with an artifact-local npm cache.
function run(command, args, options = {}) {
  childProcess.execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false',
      NO_UPDATE_NOTIFIER: '1',
    },
    ...options,
  });
}

// Copies source entries while excluding generated or dependency directories.
function copyEntry(entry, targetRoot) {
  fs.cpSync(path.join(root, entry), path.join(targetRoot, entry), {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(root, source).replaceAll('\\', '/');
      return ![
        'artifacts',
        'node_modules',
        'src-tauri/target',
      ].some((ignored) => relative === ignored || relative.startsWith(`${ignored}/`));
    },
  });
}

// Adds the CI platform label to release assets so macOS/Windows bundle names do
// not collide when every matrix artifact is uploaded to the same GitHub Release.
function labelArtifactName(fileName) {
  if (!artifactLabel) {
    return fileName;
  }
  const parsed = path.parse(fileName);
  return `${parsed.name}-${artifactLabel}${parsed.ext}`;
}

fs.rmSync(artifactsDir, { recursive: true, force: true });
fs.mkdirSync(artifactsDir, { recursive: true });

if (!bundlesOnly) {
  const npmPackageRoot = path.join(artifactsDir, 'package');
  fs.mkdirSync(npmPackageRoot, { recursive: true });
  for (const entry of packageEntries) {
    copyEntry(entry, npmPackageRoot);
  }
  run('tar', ['-czf', `fpasoterm-${version}.tgz`, 'package'], {
    cwd: artifactsDir,
  });
  fs.rmSync(npmPackageRoot, { recursive: true, force: true });
}

if (!sourceOnly) {
  const buildArgs = ['run', 'build'];
  if (process.platform === 'linux') {
    // AppImage bundling is unstable in some ChromeOS/Baguette and CI
    // environments. Build the Linux package formats that are currently
    // reproducible, and keep the source archives platform-independent.
    buildArgs.push('--', '--bundles', 'deb,rpm');
  }
  run(npmCommand, buildArgs);

  const bundleDir = path.join(root, 'src-tauri', 'target', 'release', 'bundle');
  if (fs.existsSync(bundleDir)) {
    const copyBundles = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.endsWith('.app')) {
            const appArchive = `${entry.name.replace(/\.app$/, '')}-${version}-${artifactLabel || process.arch}.app.tar.gz`;
            run('tar', ['-czf', path.join(artifactsDir, appArchive), entry.name], {
              cwd: directory,
            });
          } else {
            copyBundles(entryPath);
          }
        } else if (
          entry.isFile()
          && ['.deb', '.rpm', '.dmg', '.msi', '.exe'].includes(path.extname(entry.name))
          && entry.name.includes(version)
        ) {
          fs.copyFileSync(entryPath, path.join(artifactsDir, labelArtifactName(entry.name)));
        }
      }
    };
    copyBundles(bundleDir);
  }
}

let portableRoot;
if (!bundlesOnly) {
  const portableName = `fpasoterm-${version}-source-portable`;
  portableRoot = path.join(artifactsDir, portableName);
  fs.mkdirSync(portableRoot, { recursive: true });

  for (const entry of packageEntries) {
    copyEntry(entry, portableRoot);
  }

  run('tar', ['-czf', `${portableName}.tar.gz`, portableName], {
    cwd: artifactsDir,
  });
}

if (portableRoot) {
  fs.rmSync(portableRoot, { recursive: true, force: true });
}
fs.rmSync(npmCacheDir, { recursive: true, force: true });
console.log(`Artifacts written to ${artifactsDir}`);
