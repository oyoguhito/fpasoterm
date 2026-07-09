const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const ignoredDirs = new Set([
  '.git',
  '.jj',
  'artifacts',
  'node_modules',
  'diagnostics',
]);

const ignoredFiles = new Set([
  'package-lock.json',
]);

const patterns = [
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9_]{36,}/],
  ['npm token', /npm_[A-Za-z0-9]{36,}/],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Private key header', /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['Generic assigned secret', /\b(?:api[_-]?key|secret|token|password|passwd|pwd)\b\s*[:=]\s*['"][^'"]{12,}['"]/i],
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function isBinary(buffer) {
  return buffer.includes(0);
}

const findings = [];

for (const file of walk(root)) {
  const relative = path.relative(root, file);
  if (ignoredFiles.has(relative)) {
    continue;
  }

  const buffer = fs.readFileSync(file);
  if (isBinary(buffer)) {
    continue;
  }

  const lines = buffer.toString('utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const [name, pattern] of patterns) {
      if (pattern.test(line)) {
        findings.push(`${relative}:${index + 1}: possible ${name}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Potential credentials found:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('secret scan passed');
