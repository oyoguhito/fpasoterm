const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertFile(relativePath) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} should exist`);
}

const packageJson = JSON.parse(read('package.json'));

assert.equal(packageJson.name, 'fpasoterm');
assert.equal(packageJson.version, '0.0.1');
assert.equal(packageJson.main, 'src/main.js');
assert.equal(packageJson.bin.fpasoterm, 'bin/fpasoterm');
assert.equal(packageJson.license, 'MIT');
assert.equal(packageJson.repository.url, 'git+https://github.com/oyoguhito/fpasoterm.git');
assertFile('bin/fpasoterm');
assertFile('LICENSE');
assertFile('CHANGELOG.md');
assertFile('CONTRIBUTING.md');
assertFile('INSTALL.md');
assertFile('extra/logo/fpasoterm.png');
assertFile('scripts/security/scan-secrets.js');

for (const file of [
  'src/main.js',
  'src/preload.js',
  'src/renderer/index.html',
  'src/renderer/renderer.js',
  'src/renderer/styles.css',
  'extra/linux/io.github.oyoguhito.FpasoTerm.desktop',
  'docs/spec.en.md',
  'docs/spec.ja.md',
  'docs/release-checklist.en.md',
  'docs/release-checklist.ja.md',
]) {
  assertFile(file);
}

const main = read('src/main.js');
assert.match(main, /FPASOTERM_DEBUG_KEYS/);
assert.match(main, /ozone-platform/);
assert.doesNotMatch(main, /ibus/i);

const bin = read('bin/fpasoterm');
assert.match(bin, /--ozone-platform=/);
assert.match(bin, /FPASOTERM_OZONE_PLATFORM/);

const preload = read('src/preload.js');
assert.match(preload, /contextBridge\.exposeInMainWorld\('fpasoterm'/);

const desktop = read('extra/linux/io.github.oyoguhito.FpasoTerm.desktop');
assert.match(desktop, /^Name=FpasoTerm$/m);
assert.match(desktop, /^Icon=fpasoterm$/m);
assert.match(desktop, /^StartupWMClass=io\.github\.oyoguhito\.FpasoTerm$/m);

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
