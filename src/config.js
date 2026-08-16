const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const toml = require('smol-toml');
const ts = require('typescript');

const defaultTerminalFontFamily = '"Noto Sans Mono CJK JP", "Noto Sans CJK JP", "BIZ UDGothic", "Hiragino Sans", Meiryo, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const macosTerminalFontFamily = '"SF Mono", Menlo, ui-monospace, SFMono-Regular, "Hiragino Sans", "Hiragino Kaku Gothic ProN", monospace';

// The complete set of supported user settings. This object is also used to
// fill missing keys when a user provides a partial config.toml.
const defaultConfig = Object.freeze({
  window: {
    title: 'fpasoterm',
    width: 1000,
    height: 680,
    minWidth: 420,
    minHeight: 260,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    titlebarColor: '#1565c0',
    titleLocked: true,
    themeSource: 'system',
    frame: false,
    rememberBounds: true,
  },
  terminal: {
    allowTransparency: true,
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: defaultTerminalFontFamily,
    fontSize: 14,
    lineHeight: 1.12,
    minimumContrastRatio: 4.5,
    rescaleOverlappingGlyphs: true,
    backgroundOpacity: 0.8,
    scrollback: 1000,
    termName: 'xterm-256color',
    shell: '',
    images: {
      enabled: false,
      kittySupport: false,
      kittySizeLimit: 33554432,
      storageLimit: 64,
      sixelSupport: false,
      iipSupport: false,
    },
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
  keybindings: {
    prefix: 'Mod+Shift',
    logMenu: 'L',
    logToggle: 'S',
    logShow: 'P',
    copy: 'C',
    paste: 'V',
    menu: 'M',
    help: 'H',
    newWindow: 'N',
    broadcast: 'B',
    kill: 'K',
    tile: 'T',
    closeAll: 'X',
  },
  plugins: {
    enabled: [],
  },
  sync: {
    enabled: false,
    provider: 'folder',
    path: '',
    channel: 'default',
    diagnostics: true,
    maxBytes: 1048576,
    commands: true,
    commandTtlSeconds: 60,
  },
  logging: {
    enabled: true,
    directory: '',
    autoStart: false,
    maxBytes: 10485760,
  },
});

// Uses macOS-native monospace fonts before CJK fallbacks. Hiragino Sans is
// proportional, so using it as the first available font makes xterm cells look spaced out.
function platformDefaultConfig(platform = process.platform, architecture = process.arch) {
  if (platform === 'darwin') {
    return mergeConfig(defaultConfig, {
      terminal: {
        fontFamily: macosTerminalFontFamily,
        fontSize: architecture === 'x64' ? 12 : 14,
      },
    });
  }
  return defaultConfig;
}

// Safely migrates only the old shipped default, preserving custom font choices.
function migrateLegacyMacosFontFamily(config, platform = process.platform) {
  if (platform !== 'darwin' || config?.terminal?.fontFamily !== defaultTerminalFontFamily) {
    return config;
  }
  return mergeConfig(config, { terminal: { fontFamily: macosTerminalFontFamily } });
}

// Returns the settings persisted in user config files. Image protocol options
// remain internal until their renderer support is stable.
function writableConfigDefaults(platform = process.platform, architecture = process.arch) {
  const defaults = mergeConfig({}, platformDefaultConfig(platform, architecture));
  delete defaults.terminal.images;
  return defaults;
}

// Writes the default TOML with comments so users can copy it to config.toml
// and understand what each section controls.
function defaultConfigExample(platform = process.platform, architecture = process.arch) {
  const terminalDefaults = platformDefaultConfig(platform, architecture).terminal;
  return `# fpasoterm user configuration.
# Copy this file to config.toml and edit the values you want to change.

# Window options are applied when the application window is created.
[window]
title = "fpasoterm"
width = 1000
height = 680
minWidth = 420
minHeight = 260
backgroundColor = "rgba(0, 0, 0, 0)"
# titlebarColor controls the custom titlebar background when frame is false.
titlebarColor = "#1565c0"
# titleLocked prevents shell-emitted title sequences from replacing title.
titleLocked = true
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
fontFamily = ${JSON.stringify(terminalDefaults.fontFamily)}
fontSize = ${terminalDefaults.fontSize}
# lineHeight leaves enough vertical room for underscores and descenders.
lineHeight = 1.12
# minimumContrastRatio raises foreground colors that are too close to the terminal background.
minimumContrastRatio = 4.5
# rescaleOverlappingGlyphs helps CJK and half-width kana glyphs fit terminal cells.
rescaleOverlappingGlyphs = true
# backgroundOpacity changes only the terminal background alpha, not text opacity.
backgroundOpacity = 0.8
scrollback = 1000
# termName is the terminal type used by xterm.js. The backend PTY exports
# TERM=xterm-256color so terminal multiplexers such as tmux can use terminfo.
termName = "xterm-256color"
# shell overrides the platform default when non-empty.
# Windows examples: "powershell.exe", "pwsh.exe", or "cmd.exe".
shell = ""

# [terminal.images] is reserved for a future stable renderer. Current builds
# ignore it, so do not add this section to config.toml.

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

# Keybindings use Mod for Ctrl on Windows/Linux and Cmd on macOS.
# Set prefix = "Ctrl+Alt" on Windows when Ctrl+Shift is unavailable.
# Individual values may be a key such as "N" or a full shortcut such as
# "Ctrl+Alt+KeyN". Use KeyN-style values for physical-key bindings.
[keybindings]
prefix = "Mod+Shift"
logMenu = "L"
logToggle = "S"
logShow = "P"
copy = "C"
paste = "V"
menu = "M"
help = "H"
newWindow = "N"
broadcast = "B"
kill = "K"
tile = "T"
closeAll = "X"

# Plugins are relative to ~/.config/fpasoterm/User/.
# Example: enabled = ["plugins/hello.ts", "plugins/theme.ts"]
[plugins]
enabled = []

# Sync folder options use an already-synced local folder, such as Google Drive.
# fpasoterm does not call Google Drive APIs or perform OAuth.
[sync]
enabled = false
provider = "folder"
# Example: path = "~/Google Drive/fpasoterm-sync"
path = ""
channel = "default"
diagnostics = true
maxBytes = 1048576
# commands enables explicitly requested broadcast input through this folder.
commands = true
# Command files expire quickly so they are not executed after a delayed sync.
commandTtlSeconds = 60

# Terminal output logging records readable PTY output with control sequences
# removed when started from the titlebar or an OSC 777 command.
# The default directory is User/logs.
[logging]
enabled = true
# Example: directory = "~/Google Drive/fpasoterm-sync/logs"
directory = ""
autoStart = false
maxBytes = 10485760
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

// Lists default leaf settings that are absent from a user configuration.
function missingConfigKeys(defaults, config, prefix = '') {
  const missing = [];
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const hasValue = isObject(config) && Object.hasOwn(config, key);
    const configuredValue = hasValue ? config[key] : undefined;
    if (isObject(defaultValue)) {
      missing.push(...missingConfigKeys(defaultValue, configuredValue, path));
    } else if (!hasValue) {
      missing.push(path);
    }
  }
  return missing;
}

// Removes settings that are not part of the current supported configuration.
function pruneUnsupportedConfig(defaults, config, prefix = '') {
  if (!isObject(config)) {
    return { config, removed: [] };
  }

  const pruned = {};
  const removed = [];
  for (const [key, value] of Object.entries(config)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!Object.hasOwn(defaults, key)) {
      removed.push(path);
      continue;
    }
    if (isObject(defaults[key]) && isObject(value)) {
      const nested = pruneUnsupportedConfig(defaults[key], value, path);
      pruned[key] = nested.config;
      removed.push(...nested.removed);
    } else {
      pruned[key] = value;
    }
  }
  return { config: pruned, removed };
}

// Drops config sections that were removed from the supported schema.
function removeUnsupportedConfigSections(config) {
  delete config[['web', 'Console'].join('')];
  return config;
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
  let config = removeUnsupportedConfigSections(mergeConfig(platformDefaultConfig(), userConfig));
  config = migrateLegacyMacosFontFamily(config);
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
  migrateLegacyMacosFontFamily,
  mergeConfig,
  missingConfigKeys,
  pruneUnsupportedConfig,
  platformDefaultConfig,
  writableConfigDefaults,
  windowStatePath,
};
