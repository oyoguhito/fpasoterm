const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const toml = require('smol-toml');
const ts = require('typescript');

// The complete set of supported user settings. This object is also used to
// fill missing keys when a user provides a partial config.toml.
const defaultConfig = Object.freeze({
  window: {
    width: 1000,
    height: 680,
    minWidth: 420,
    minHeight: 260,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    themeSource: 'system',
    frame: false,
    rememberBounds: true,
  },
  terminal: {
    allowTransparency: true,
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Noto Sans Mono CJK JP", monospace',
    fontSize: 14,
    scrollback: 1000,
    theme: {
      background: 'rgba(16, 19, 23, 0.80)',
      foreground: '#e8edf2',
      cursor: '#f5d76e',
      selectionBackground: '#35506b',
      black: '#11151a',
      red: '#ff6b6b',
      green: '#8bd17c',
      yellow: '#f5d76e',
      blue: '#7bb7ff',
      magenta: '#d7a8ff',
      cyan: '#63d4d5',
      white: '#e8edf2',
      brightBlack: '#5d6978',
      brightRed: '#ff8f8f',
      brightGreen: '#ade89f',
      brightYellow: '#ffe08a',
      brightBlue: '#a4ceff',
      brightMagenta: '#e3c3ff',
      brightCyan: '#9de9ea',
      brightWhite: '#ffffff',
    },
  },
  ime: {
    duplicateGuard: true,
    duplicateWindowMs: 800,
    repeatedTextWindowMs: 140,
  },
  plugins: {
    enabled: [],
  },
});

// Writes the default TOML with comments so users can copy it to config.toml
// and understand what each section controls.
function defaultConfigExample() {
  return `# fpasoterm user configuration.
# Copy this file to config.toml and edit the values you want to change.

# Window options are applied when the application window is created.
[window]
width = 1000
height = 680
minWidth = 420
minHeight = 260
backgroundColor = "rgba(0, 0, 0, 0)"
# themeSource can be "system", "light", or "dark".
themeSource = "system"
# frame controls whether the native window frame/titlebar is shown.
frame = false
# rememberBounds controls whether size is saved to User/window-state.json.
rememberBounds = true

# Terminal options are passed to xterm.js when the terminal is created.
[terminal]
allowTransparency = true
cursorBlink = true
cursorStyle = "block"
fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, \\"Noto Sans Mono CJK JP\\", monospace"
fontSize = 14
scrollback = 1000

# Terminal color palette.
[terminal.theme]
background = "rgba(16, 19, 23, 0.80)"
foreground = "#e8edf2"
cursor = "#f5d76e"
selectionBackground = "#35506b"
black = "#11151a"
red = "#ff6b6b"
green = "#8bd17c"
yellow = "#f5d76e"
blue = "#7bb7ff"
magenta = "#d7a8ff"
cyan = "#63d4d5"
white = "#e8edf2"
brightBlack = "#5d6978"
brightRed = "#ff8f8f"
brightGreen = "#ade89f"
brightYellow = "#ffe08a"
brightBlue = "#a4ceff"
brightMagenta = "#e3c3ff"
brightCyan = "#9de9ea"
brightWhite = "#ffffff"

# IME guard options reduce duplicate text after composition commits.
[ime]
duplicateGuard = true
duplicateWindowMs = 800
repeatedTextWindowMs = 140

# Plugins are relative to ~/.config/fpasoterm/User/.
# Example: enabled = ["plugins/hello.ts", "plugins/theme.ts"]
[plugins]
enabled = []
`;
}

// Returns the user-editable config directory under the runtime profile.
function configDir() {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'fpasoterm', 'User');
}

// Returns the active TOML config file path.
function configPath() {
  if (process.env.FPASOTERM_CONFIG_PATH) {
    return path.resolve(process.env.FPASOTERM_CONFIG_PATH);
  }
  return path.join(configDir(), 'config.toml');
}

// Returns the runtime profile directory used by the desktop runtime.
function profileDir() {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'fpasoterm');
}

// Returns the local window state file used to remember bounds.
function windowStatePath() {
  return path.join(configDir(), 'window-state.json');
}

// Returns the old pre-User window state path for read-only migration.
function legacyWindowStatePath() {
  return path.join(profileDir(), 'window-state.json');
}

// Checks for plain objects so arrays and scalar TOML values are not merged recursively.
function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Deep-merges user settings over defaults while preserving missing default keys.
function mergeConfig(base, override) {
  if (!isObject(override)) {
    return base;
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isObject(value) && isObject(base[key])) {
      merged[key] = mergeConfig(base[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

// Keeps config.toml.example in sync without overwriting the user's config.toml.
function writeDefaultConfigExample(targetPath) {
  const examplePath = `${targetPath}.example`;
  const example = defaultConfigExample();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (!fs.existsSync(examplePath) || fs.readFileSync(examplePath, 'utf8') !== example) {
    fs.writeFileSync(examplePath, example);
  }
}

// Parses the user's TOML config. Missing files are treated as an empty override.
function readUserConfig(targetPath = configPath()) {
  if (!fs.existsSync(targetPath)) {
    return {};
  }

  return toml.parse(fs.readFileSync(targetPath, 'utf8'));
}

// Writes a user config file, used by CLI commands that edit plugin settings.
function writeUserConfig(config, targetPath = configPath()) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `# fpasoterm user configuration.\n${toml.stringify(config)}`);
}

// Reads saved window bounds from the local profile directory.
function readableWindowStatePath(targetPath = windowStatePath()) {
  let statePath = targetPath;
  if (!fs.existsSync(statePath)) {
    const legacyPath = legacyWindowStatePath();
    statePath = targetPath === windowStatePath() && fs.existsSync(legacyPath) ? legacyPath : targetPath;
  }
  return fs.existsSync(statePath) ? statePath : undefined;
}

// Reads saved window bounds from the local profile directory.
function readWindowState(targetPath = windowStatePath()) {
  const statePath = readableWindowStatePath(targetPath);

  if (!statePath) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
}

// Writes the current window bounds so the next launch can restore them.
function writeWindowState(state, targetPath = windowStatePath()) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(state, null, 2)}\n`);
}

// Keeps only supported window state keys so older x/y entries are ignored.
function sanitizeWindowState(state) {
  const window = state.window && typeof state.window === 'object' ? state.window : {};
  const sanitized = {};
  if (Number.isInteger(window.width) && window.width > 0) {
    sanitized.width = window.width;
  }
  if (Number.isInteger(window.height) && window.height > 0) {
    sanitized.height = window.height;
  }
  return { window: sanitized };
}

// Deletes saved window bounds so configured/default bounds are used again.
function deleteWindowState(targetPath = windowStatePath()) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath);
  }
  if (targetPath === windowStatePath()) {
    const legacyPath = legacyWindowStatePath();
    if (fs.existsSync(legacyPath)) {
      fs.rmSync(legacyPath);
    }
  }
}

// Lists JavaScript and TypeScript plugin files below User/plugins.
function discoverPluginFiles(targetPath = configPath()) {
  const pluginsDir = path.join(path.dirname(targetPath), 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    return [];
  }

  const discovered = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && ['.js', '.ts'].includes(path.extname(entry.name))) {
        discovered.push(path.relative(path.dirname(targetPath), entryPath).replaceAll('\\', '/'));
      }
    }
  };
  visit(pluginsDir);
  return discovered.sort();
}

// Resolves a file name or plugins-relative path to one unambiguous plugin entry.
function resolvePluginSelector(selector, candidates, action) {
  const normalized = selector.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^plugins\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`invalid plugin name: ${selector}`);
  }

  const exact = `plugins/${normalized}`;
  const matches = normalized.includes('/')
    ? candidates.filter((candidate) => candidate === exact)
    : candidates.filter((candidate) => path.posix.basename(candidate) === normalized);

  if (matches.length === 0) {
    throw new Error(`cannot ${action} plugin '${selector}': no matching plugin file`);
  }
  if (matches.length > 1) {
    throw new Error(`plugin name '${selector}' is ambiguous; use one of: ${matches.join(', ')}`);
  }
  return matches[0];
}

// Resolves enabled plugin files and transpiles TypeScript plugins into User/cache.
function resolvePluginUrls(config, rootDir) {
  const enabled = Array.isArray(config.plugins?.enabled) ? config.plugins.enabled : [];
  const pluginsDir = path.join(rootDir, 'plugins');
  const cacheDir = path.join(rootDir, 'cache', 'plugins');
  const pluginRoot = `${path.resolve(pluginsDir)}${path.sep}`;

  return enabled.flatMap((entry) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      return [];
    }

    const pluginPath = path.resolve(rootDir, entry);
    const extension = path.extname(pluginPath);
    if (!pluginPath.startsWith(pluginRoot) || !['.js', '.ts'].includes(extension)) {
      return [];
    }

    // TypeScript plugins are transpiled to JavaScript because the renderer can
    // only load script files directly.
    if (extension === '.ts') {
      const relativeName = path.relative(pluginsDir, pluginPath);
      const compiledPath = path.join(cacheDir, relativeName.replace(/\.ts$/, '.js'));
      const source = fs.readFileSync(pluginPath, 'utf8');
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.None,
          target: ts.ScriptTarget.ES2020,
          removeComments: false,
          sourceMap: false,
        },
        fileName: pluginPath,
      });
      fs.mkdirSync(path.dirname(compiledPath), { recursive: true });
      fs.writeFileSync(
        compiledPath,
        `${compiled.outputText}\n//# sourceURL=${pathToFileURL(pluginPath).toString()}\n`,
      );

      return [{
        name: path.relative(rootDir, pluginPath),
        url: pathToFileURL(compiledPath).toString(),
      }];
    }

    return [{
      name: path.relative(rootDir, pluginPath),
      url: pathToFileURL(pluginPath).toString(),
    }];
  });
}

// Loads the full runtime config and the renderer-loadable plugin script URLs.
function loadConfig() {
  const file = configPath();
  const dir = path.dirname(file);
  writeDefaultConfigExample(file);

  const userConfig = readUserConfig(file);
  const config = mergeConfig(defaultConfig, userConfig);
  if (config.window?.rememberBounds !== false) {
    const statePath = readableWindowStatePath();
    if (statePath) {
      config.window = mergeConfig(config.window, sanitizeWindowState(readWindowState(statePath)).window);
    }
  }
  const pluginUrls = resolvePluginUrls(config, dir);

  return {
    config,
    configDir: dir,
    configPath: file,
    pluginUrls,
    windowStatePath: windowStatePath(),
  };
}

module.exports = {
  defaultConfig,
  defaultConfigExample,
  configDir,
  configPath,
  deleteWindowState,
  discoverPluginFiles,
  profileDir,
  readUserConfig,
  resolvePluginSelector,
  writeUserConfig,
  readWindowState,
  writeWindowState,
  loadConfig,
  windowStatePath,
};
