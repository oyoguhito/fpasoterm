const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const toml = require('smol-toml');
const ts = require('typescript');

const nerdFontFallback = '"Symbols Nerd Font Mono", "Symbols Nerd Font", "JetBrainsMono Nerd Font"';
// CJK monospace candidates cover Japanese, Korean, Chinese, and half-width kana.
const cjkMonospaceFontFallback = '"DejaVu Sans Mono", "Noto Sans Mono", "Noto Sans Mono CJK JP", "Noto Sans Mono CJK KR", "Noto Sans Mono CJK SC", "NanumGothicCoding", "BIZ UDGothic"';
const broadCjkFontFallback = '"Noto Sans CJK JP", "Noto Sans CJK KR", "Noto Sans CJK SC", "Noto Sans CJK TC", "Hiragino Kaku Gothic ProN", "Apple SD Gothic Neo", "Malgun Gothic", Meiryo';
// Prefer an installed monospace font for terminal cell measurement. Nerd Font
// fallbacks remain available for private-use glyphs without becoming the base font.
const defaultTerminalFontFamily = `${cjkMonospaceFontFallback}, ${nerdFontFallback}, ${broadCjkFontFallback}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const legacyMacosTerminalFontFamily = `"SF Mono", Menlo, ui-monospace, SFMono-Regular, ${nerdFontFallback}, ${broadCjkFontFallback}, monospace`;
// Menlo's box and block glyph metrics match the macOS Terminal renderer more closely.
const macosTerminalFontFamily = `Menlo, "SF Mono", ui-monospace, SFMono-Regular, ${nerdFontFallback}, ${broadCjkFontFallback}, monospace`;
// Keep descenders such as g, q, and y visibly separate from the next row.
const defaultTerminalLineHeight = 1;
// Prioritize readable descenders over compact TUI logo rows on macOS.
const macosTerminalLineHeight = 1;
const legacyTerminalFontFamily = `${nerdFontFallback}, "Noto Sans Mono CJK JP", "Noto Sans Mono CJK KR", "Noto Sans Mono CJK SC", "Noto Sans CJK JP", "Noto Sans CJK KR", "Noto Sans CJK SC", "Noto Sans CJK TC", "NanumGothicCoding", "BIZ UDGothic", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Apple SD Gothic Neo", "Malgun Gothic", Meiryo, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

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
    lineHeight: defaultTerminalLineHeight,
    minimumContrastRatio: 1,
    rescaleOverlappingGlyphs: false,
    backgroundOpacity: 0.65,
    scrollback: 1000,
    termName: 'xterm-256color',
    shell: '',
    // Keep enhanced Kitty keyboard negotiation opt-in until IME behavior is
    // verified across the supported WebView implementations.
    kittyKeyboard: false,
    images: {
      enabled: false,
      kittySupport: false,
      kittySizeLimit: 33554432,
      storageLimit: 64,
      sixelSupport: false,
      iipSupport: false,
    },
    theme: {
      background: 'rgba(16, 19, 23, 0.65)',
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
    commands: false,
    // Shared-folder command delivery requires this secret on every participant.
    commandSecret: '',
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
        lineHeight: macosTerminalLineHeight,
      },
    });
  }
  return defaultConfig;
}

// Safely migrates only previously shipped defaults, preserving custom font choices.
function migrateLegacyMacosFontFamily(config, platform = process.platform) {
  const fontFamily = config?.terminal?.fontFamily;
  if (platform === 'darwin' && (fontFamily === legacyTerminalFontFamily || fontFamily === legacyMacosTerminalFontFamily || fontFamily === defaultTerminalFontFamily)) {
    return mergeConfig(config, { terminal: { fontFamily: macosTerminalFontFamily } });
  }
  if (platform !== 'darwin' && fontFamily === legacyTerminalFontFamily) {
    return mergeConfig(config, { terminal: { fontFamily: defaultTerminalFontFamily } });
  }
  if (platform !== 'darwin' || fontFamily !== defaultTerminalFontFamily) {
    return config;
  }
  return mergeConfig(config, { terminal: { fontFamily: macosTerminalFontFamily } });
}

// Migrates previously shipped compact defaults while preserving custom values.
function migrateLegacyTerminalLineHeight(config, platform = process.platform) {
  const formerDefaults = platform === 'darwin' ? [0.8, 0.81, 0.82, 0.85, 0.9, 0.92, 1.12] : [0.92, 1.12];
  if (formerDefaults.includes(config?.terminal?.lineHeight)) {
    return mergeConfig(config, {
      terminal: {
        lineHeight: platform === 'darwin' ? macosTerminalLineHeight : defaultTerminalLineHeight,
      },
    });
  }
  return config;
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
# A compact value keeps adjacent rows connected for terminal art and TUI logos.
lineHeight = ${terminalDefaults.lineHeight}
# minimumContrastRatio = 1 preserves application-selected ANSI and RGB colors.
minimumContrastRatio = 1
# Keep this false for glyph fidelity in terminal applications. Enable only if needed for CJK overlap.
rescaleOverlappingGlyphs = false
# backgroundOpacity changes only the terminal background alpha, not text opacity.
backgroundOpacity = 0.65
scrollback = 1000
# termName is the terminal type used by xterm.js. The backend PTY exports
# TERM=xterm-256color so terminal multiplexers such as tmux can use terminfo.
termName = "xterm-256color"
# shell overrides the platform default when non-empty.
# Windows examples: "powershell.exe", "pwsh.exe", or "cmd.exe".
shell = ""
# kittyKeyboard enables enhanced key negotiation for compatible TUIs. Keep it
# false unless that TUI requires it; it is unrelated to the disabled graphics addon.
kittyKeyboard = false

# [terminal.images] is reserved for a future stable renderer. Current builds
# ignore it, so do not add this section to config.toml.

# Terminal color palette.
[terminal.theme]
background = "rgba(16, 19, 23, 0.65)"
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
commands = false
# Leave empty until --setup-sync generates a secret shared only with trusted devices.
commandSecret = ""
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

# Profiles are optional named overlays selected with --profile <name>.
# They may contain [window], [terminal], [ime], [keybindings], [sync], or
# [logging] settings. The selected profile overrides the normal sections.
#
# [profiles.large-font.terminal]
# fontSize = 18
#
# [profiles.transparent.terminal]
# backgroundOpacity = 0.65
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
    // Profiles are optional named overlays. Their keys are validated when the
    // profile is selected, so do not erase a whole user-owned profile here.
    if (prefix === '' && key === 'profiles' && isObject(value)) {
      pruned[key] = value;
      continue;
    }
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

// Returns deterministic names for the optional named configuration overlays.
function profileNames(config) {
  return isObject(config?.profiles) ? Object.keys(config.profiles).sort() : [];
}

// Separates normal settings from one selected profile before runtime merging.
function selectProfileConfig(userConfig, profileName = process.env.FPASOTERM_PROFILE || '') {
  const config = isObject(userConfig) ? userConfig : {};
  const profiles = isObject(config.profiles) ? config.profiles : {};
  const baseConfig = { ...config };
  delete baseConfig.profiles;
  const activeProfile = String(profileName || '').trim();
  if (!activeProfile) {
    return { baseConfig, profileConfig: {}, activeProfile: '' };
  }
  if (!Object.hasOwn(profiles, activeProfile)) {
    throw new Error(`profile '${activeProfile}' does not exist; available profiles: ${profileNames(config).join(', ') || '(none)'}`);
  }
  if (!isObject(profiles[activeProfile])) {
    throw new Error(`profile '${activeProfile}' must be a TOML table`);
  }
  return { baseConfig, profileConfig: profiles[activeProfile], activeProfile };
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
  const userDir = path.dirname(targetPath);
  fs.mkdirSync(userDir, { recursive: true });
  // Keep the documented plugin location ready without creating or replacing
  // plugin source files on the user's behalf.
  fs.mkdirSync(path.join(userDir, 'plugins'), { recursive: true });
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

// Validates the user-owned TOML without changing it. The launcher can use this
// result to explain recoverable configuration mistakes before opening a window.
function validateUserConfig(targetPath = configPath(), profileName = process.env.FPASOTERM_PROFILE || '') {
  const result = {
    configPath: targetPath,
    exists: fs.existsSync(targetPath),
    warnings: [],
    error: '',
  };

  let userConfig;
  try {
    userConfig = readUserConfig(targetPath);
  } catch (error) {
    result.error = `cannot parse TOML: ${error.message}`;
    return result;
  }

  if (userConfig.profiles !== undefined && !isObject(userConfig.profiles)) {
    result.warnings.push('profiles should be a table of named profile tables');
  }
  for (const name of profileNames(userConfig)) {
    if (!isObject(userConfig.profiles[name])) {
      result.warnings.push(`profiles.${name} should be a TOML table`);
    }
  }
  if (profileName && !profileNames(userConfig).includes(profileName)) {
    result.warnings.push(`selected profile '${profileName}' does not exist`);
  }

  const fontSize = userConfig.terminal?.fontSize;
  if (fontSize !== undefined && (typeof fontSize !== 'number' || !Number.isFinite(fontSize) || fontSize <= 0)) {
    result.warnings.push('terminal.fontSize should be a positive number');
  }

  if (userConfig.terminal?.kittyKeyboard !== undefined && typeof userConfig.terminal.kittyKeyboard !== 'boolean') {
    result.warnings.push('terminal.kittyKeyboard should be true or false');
  }

  for (const [key, value] of [
    ['window.width', userConfig.window?.width],
    ['window.height', userConfig.window?.height],
    ['window.minWidth', userConfig.window?.minWidth],
    ['window.minHeight', userConfig.window?.minHeight],
    ['terminal.lineHeight', userConfig.terminal?.lineHeight],
    ['terminal.scrollback', userConfig.terminal?.scrollback],
    ['logging.maxBytes', userConfig.logging?.maxBytes],
  ]) {
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) {
      result.warnings.push(`${key} should be a positive number`);
    }
  }

  const enabled = userConfig.plugins?.enabled;
  if (enabled !== undefined && !Array.isArray(enabled)) {
    result.warnings.push('plugins.enabled should be an array of .js/.ts file names');
  } else if (Array.isArray(enabled)) {
    const rootDir = path.dirname(targetPath);
    for (const plugin of enabled) {
      const pluginPath = typeof plugin === 'string' ? path.resolve(rootDir, plugin) : '';
      if (typeof plugin !== 'string' || !pluginPath.startsWith(`${path.resolve(rootDir, 'plugins')}${path.sep}`)
        || !['.js', '.ts'].includes(path.extname(pluginPath))) {
        result.warnings.push(`plugins.enabled includes invalid entry ${JSON.stringify(plugin)}`);
      } else if (!fs.existsSync(pluginPath)) {
        result.warnings.push(`plugins.enabled includes ${plugin} but file does not exist`);
      }
    }
  }

  const sync = userConfig.sync;
  if (sync?.commands === true && (typeof sync.commandSecret !== 'string' || sync.commandSecret.length < 32)) {
    result.warnings.push('sync.commands requires sync.commandSecret with at least 32 characters; run fpasoterm --setup-sync');
  }

  const unsupported = pruneUnsupportedConfig(writableConfigDefaults(), userConfig).removed;
  for (const key of unsupported) {
    result.warnings.push(`${key} is not a supported configuration key`);
  }
  return result;
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

// Resolves a filename or plugins-relative path, with an optional .js/.ts suffix, to one plugin entry.
function resolvePluginSelector(selector, candidates, action) {
  const normalized = selector.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^plugins\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`invalid plugin name: ${selector}`);
  }

  const extensionless = !['.js', '.ts'].includes(path.posix.extname(normalized));
  const matches = candidates.filter((candidate) => {
    const relative = candidate.replace(/^plugins\//, '');
    const candidateSelector = normalized.includes('/') ? relative : path.posix.basename(relative);
    if (candidateSelector === normalized) return true;
    return extensionless && candidateSelector.replace(/\.(?:js|ts)$/, '') === normalized;
  });

  if (matches.length === 0) {
    throw new Error(`cannot ${action} plugin '${selector}': no matching plugin file`);
  }
  if (matches.length > 1) {
    throw new Error(`plugin name '${selector}' is ambiguous; use one of: ${matches.join(', ')}`);
  }
  return matches[0];
}

// Reads optional single-file plugin metadata without requiring a manifest or
// changing the established User/plugins .js/.ts layout.
function pluginMetadata(source) {
  const metadata = {};
  let fallbackDescription = '';
  for (const line of String(source || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    const header = trimmed.match(/^\/\/\s*@fpasoterm-plugin\s+(version|description)\s*:\s*(.+?)\s*$/i);
    if (header) {
      metadata[header[1].toLowerCase()] = header[2];
      continue;
    }
    if (!fallbackDescription && trimmed.startsWith('//') && !trimmed.startsWith('///')) {
      fallbackDescription = trimmed.replace(/^\/\/\s*/, '');
    }
  }
  return {
    version: metadata.version || '(not declared)',
    description: metadata.description || fallbackDescription || '(no leading plugin comment)',
  };
}

// Loads metadata from one trusted plugin source for CLI reporting.
function readPluginMetadata(pluginPath) {
  return pluginMetadata(fs.readFileSync(pluginPath, 'utf8'));
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

    const relativeName = path.relative(pluginsDir, pluginPath);
    const compiledPath = path.join(cacheDir, relativeName.replace(/\.ts$/, '.js'));
    const source = fs.readFileSync(pluginPath, 'utf8');
    let output = source;

    // TypeScript plugins are transpiled to JavaScript because the renderer can
    // only load script files directly.
    if (extension === '.ts') {
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.None,
          target: ts.ScriptTarget.ES2020,
          removeComments: false,
          sourceMap: false,
        },
        fileName: pluginPath,
      });
      output = compiled.outputText;
    }

    // Each plugin is a classic script. Isolate its top-level declarations so
    // two trusted plugins can independently use names such as `const api`.
    fs.mkdirSync(path.dirname(compiledPath), { recursive: true });
    fs.writeFileSync(
      compiledPath,
      `(() => {\n${output}\n})();\n//# sourceURL=${pathToFileURL(pluginPath).toString()}\n`,
    );

    return [{
      name: path.relative(rootDir, pluginPath),
      url: pathToFileURL(compiledPath).toString(),
    }];
  });
}

// Loads the full runtime config and the renderer-loadable plugin script URLs.
function loadConfig() {
  const file = configPath();
  const dir = path.dirname(file);
  writeDefaultConfigExample(file);

  const userConfig = readUserConfig(file);
  const selected = selectProfileConfig(userConfig);
  let config = removeUnsupportedConfigSections(mergeConfig(
    mergeConfig(platformDefaultConfig(), selected.baseConfig),
    selected.profileConfig,
  ));
  config = migrateLegacyMacosFontFamily(config);
  config = migrateLegacyTerminalLineHeight(config);
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
    activeProfile: selected.activeProfile,
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
  pluginMetadata,
  readPluginMetadata,
  readUserConfig,
  validateUserConfig,
  resolvePluginSelector,
  writeUserConfig,
  readWindowState,
  writeWindowState,
  loadConfig,
  migrateLegacyMacosFontFamily,
  migrateLegacyTerminalLineHeight,
  mergeConfig,
  missingConfigKeys,
  pruneUnsupportedConfig,
  profileNames,
  platformDefaultConfig,
  selectProfileConfig,
  writableConfigDefaults,
  windowStatePath,
};
