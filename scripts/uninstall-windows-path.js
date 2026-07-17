const childProcess = require('node:child_process');

// Normalizes a Windows PATH entry enough for case-insensitive comparison.
function normalizePathEntry(value) {
  return value
    .trim()
    .replace(/^"+|"+$/g, '')
    .replaceAll('/', '\\')
    .replace(/[\\;]+$/g, '')
    .toLowerCase();
}

// Keeps this uninstaller scoped to fpasoterm-owned directories only.
function isFpasotermPathEntry(value) {
  const normalized = normalizePathEntry(value);
  if (!normalized) {
    return false;
  }

  const parts = normalized.split('\\').filter(Boolean);
  const last = parts.at(-1);
  const parent = parts.at(-2);
  return last === 'fpasoterm' || parent === 'fpasoterm' || normalized.includes('\\fpasoterm\\');
}

// Reads the current user's Path value through PowerShell's .NET API.
function readUserPath() {
  return childProcess.execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      "[Environment]::GetEnvironmentVariable('Path', 'User')",
    ],
    { encoding: 'utf8' },
  ).trim();
}

// Writes the current user's Path through .NET to avoid truncating long values.
function writeUserPath(value) {
  childProcess.execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      "[Environment]::SetEnvironmentVariable('Path', $env:FPASOTERM_UNINSTALL_USER_PATH, 'User')",
    ],
    {
      env: {
        ...process.env,
        FPASOTERM_UNINSTALL_USER_PATH: value,
      },
      stdio: 'inherit',
    },
  );
}

// Removes fpasoterm-specific entries from the current user's Path.
function main() {
  const currentPath = readUserPath();
  const entries = currentPath.split(';').filter((entry) => entry.trim());
  const kept = [];
  const removed = [];
  const seen = new Set();

  for (const entry of entries) {
    const normalized = normalizePathEntry(entry);
    if (isFpasotermPathEntry(entry)) {
      removed.push(entry);
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      kept.push(entry);
    }
  }

  if (removed.length === 0) {
    console.log('no fpasoterm path entries found in the current user Path');
    return;
  }

  writeUserPath(kept.join(';'));
  for (const entry of removed) {
    console.log(`removed user Path entry: ${entry}`);
  }
  console.log('restart terminals or sign out and back in for the updated Path to be visible everywhere');
}

main();
