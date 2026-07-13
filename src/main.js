const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const pty = require('node-pty');
const { loadConfig, profileDir, writeWindowState } = require('./config');

const APP_ID = 'io.github.oyoguhito.fpasoterm';
const APP_NAME = 'fpasoterm';
const DEBUG_KEYS = process.env.FPASOTERM_DEBUG_KEYS === '1';
const CONSOLE_DIAGNOSTICS = process.env.FPASOTERM_CONSOLE_DIAGNOSTICS === '1';
const DISABLE_GPU = process.env.FPASOTERM_DISABLE_GPU === '1';
const OZONE_PLATFORM = process.env.FPASOTERM_OZONE_PLATFORM || (process.platform === 'linux' ? 'x11' : undefined);
const ENABLE_WAYLAND_IME = process.env.FPASOTERM_ENABLE_WAYLAND_IME === '1';
const GTK_VERSION = process.env.FPASOTERM_GTK_VERSION;
const ENABLE_FEATURES = process.env.FPASOTERM_ENABLE_FEATURES;
const START_COMMAND = process.env.FPASOTERM_START_COMMAND;
const ICON_PATH = process.platform === 'win32'
  ? path.join(__dirname, '..', 'extra', 'windows', 'fpasoterm.ico')
  : path.join(__dirname, '..', 'extra', 'logo', 'fpasoterm.png');

const terminals = new Map();
const diagnostics = [];
const diagnosticsDir = path.join(process.cwd(), 'diagnostics');
const diagnosticsPath = path.join(diagnosticsDir, 'fpasoterm-debug.log');
let runtimeConfig;

if (process.platform === 'linux' && DISABLE_GPU) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

if (process.platform === 'linux' && OZONE_PLATFORM) {
  app.commandLine.appendSwitch('ozone-platform', OZONE_PLATFORM);
}

if (process.platform === 'linux' && ENABLE_WAYLAND_IME) {
  app.commandLine.appendSwitch('enable-wayland-ime');
}

if (process.platform === 'linux' && GTK_VERSION) {
  app.commandLine.appendSwitch('gtk-version', GTK_VERSION);
}

if (ENABLE_FEATURES) {
  app.commandLine.appendSwitch('enable-features', ENABLE_FEATURES);
}

// Records diagnostics in memory and the debug log file.
function appendDiagnostic(message) {
  const line = `${new Date().toISOString()} ${message}`;
  diagnostics.push(line);
  if (diagnostics.length > 500) {
    diagnostics.shift();
  }

  if (CONSOLE_DIAGNOSTICS || DEBUG_KEYS) {
    console.error(message);
  }

  try {
    fs.mkdirSync(diagnosticsDir, { recursive: true });
    fs.appendFileSync(diagnosticsPath, `${line}\n`);
  } catch (error) {
    console.error(`Failed to write diagnostics log: ${formatError(error)}`);
  }
}

// Reads a positive integer environment override.
function readPositiveIntegerEnv(name) {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

// Applies one-launch CLI overrides after config.toml has been resolved.
function applyRuntimeOverrides(config) {
  const width = readPositiveIntegerEnv('FPASOTERM_WINDOW_WIDTH');
  const height = readPositiveIntegerEnv('FPASOTERM_WINDOW_HEIGHT');

  return {
    ...config,
    window: {
      ...config.window,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
    },
  };
}

// Converts arbitrary thrown values into readable diagnostic text.
function formatError(error) {
  if (error && error.stack) {
    return error.stack;
  }
  if (error && error.message) {
    return error.message;
  }
  return String(error);
}

// Shows main-process failures to the user and mirrors them to diagnostics.
function reportMainProcessError(title, error) {
  const message = formatError(error);
  appendDiagnostic(`${title}\n${message}`);

  if (app.isReady()) {
    dialog.showErrorBox(title, message);
  }
}

process.on('uncaughtException', (error) => {
  reportMainProcessError('Uncaught exception in fpasoterm main process', error);
});

process.on('unhandledRejection', (reason) => {
  reportMainProcessError('Unhandled rejection in fpasoterm main process', reason);
});

// Picks the user's default shell for the PTY.
function shellCommand() {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'powershell.exe';
  }

  return process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
}

// Starts the shell-backed PTY and wires its data stream to one renderer.
function spawnTerminal(webContents, options) {
  const shell = shellCommand();
  const term = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows,
    cwd: os.homedir(),
    env: {
      ...process.env,
      TERM_PROGRAM: 'fpasoterm',
    },
  });

  terminals.set(webContents.id, term);

  term.onData((data) => {
    if (!webContents.isDestroyed()) {
      webContents.send('terminal:data', data);
    }
  });

  if (START_COMMAND && START_COMMAND.trim()) {
    setImmediate(() => {
      if (!webContents.isDestroyed()) {
        term.write(`${START_COMMAND}\r`);
      }
    });
  }

  term.onExit(({ exitCode }) => {
    terminals.delete(webContents.id);
    if (!webContents.isDestroyed()) {
      webContents.send('terminal:exit', exitCode);
      const window = BrowserWindow.fromWebContents(webContents);
      if (window && !window.isDestroyed()) {
        window.close();
      }
    }
  });
}

// Logs key events only when FPASOTERM_DEBUG_KEYS=1 is enabled.
function installInputMethodHooks(window) {
  window.webContents.on('before-input-event', (_event, input) => {
    if (DEBUG_KEYS) {
      const message = `main key type=${input.type} key=${input.key} code=${input.code} composing=${input.isComposing}`;
      appendDiagnostic(message);
      window.webContents.send('diagnostics:event', {
        source: 'main',
        message,
      });
    }
  });
}

// Captures renderer console/process/load failures in the main diagnostics log.
function installRendererDiagnostics(window) {
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    appendDiagnostic(`renderer console level=${level} ${sourceId}:${line} ${message}`);
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    appendDiagnostic(`renderer process gone reason=${details.reason} exitCode=${details.exitCode}`);
  });

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appendDiagnostic(`renderer failed to load code=${errorCode} url=${validatedURL} ${errorDescription}`);
  });
}

// Sets the application icon on platforms that do not use BrowserWindow icon for the app shell.
function applyApplicationIcon() {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(ICON_PATH);
  }
}

// Returns bounds that should be restored on the next normal launch.
function restorableWindowBounds(window) {
  return window.isMaximized() || window.isFullScreen()
    ? window.getNormalBounds()
    : window.getBounds();
}

// Compares bounds snapshots so polling does not rewrite state unnecessarily.
function sameBounds(left, right) {
  return Boolean(left && right) &&
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height;
}

// Persists the latest window position and size unless disabled by config.
function saveWindowState(window) {
  if (runtimeConfig.config.window?.rememberBounds === false || window.isDestroyed()) {
    return;
  }

  const bounds = restorableWindowBounds(window);
  appendDiagnostic(`saving window bounds x=${bounds.x} y=${bounds.y} width=${bounds.width} height=${bounds.height}`);
  writeWindowState({
    window: {
      width: bounds.width,
      height: bounds.height,
    },
  });
  return bounds;
}

// Applies saved/configured size explicitly after the window manager has created the window.
function restoreWindowBounds(window, windowConfig) {
  const bounds = {};
  for (const key of ['width', 'height']) {
    if (Number.isInteger(windowConfig[key])) {
      bounds[key] = windowConfig[key];
    }
  }
  if (Object.keys(bounds).length > 0) {
    appendDiagnostic(`restoring window bounds ${JSON.stringify(bounds)}`);
    window.setBounds(bounds, false);
    const applied = window.getBounds();
    appendDiagnostic(
      `applied window bounds x=${applied.x} y=${applied.y} width=${applied.width} height=${applied.height}`,
    );
  }
}

// Reapplies size around first show because some Linux window managers adjust creation-time bounds.
function installWindowBoundsRestore(window, windowConfig) {
  const restore = () => restoreWindowBounds(window, windowConfig);

  restore();
  window.once('ready-to-show', () => {
    restore();
    window.show();
  });
  window.webContents.once('did-finish-load', restore);
}

// Saves bounds while the user moves or resizes the window, without writing per frame.
function installWindowStatePersistence(window) {
  let saveTimer;
  let readyToSave = false;
  let lastSavedBounds;
  const scheduleSave = () => {
    if (!readyToSave) {
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      lastSavedBounds = saveWindowState(window);
    }, 250);
  };

  for (const eventName of ['move', 'moved', 'resize', 'resized']) {
    window.on(eventName, scheduleSave);
  }

  setTimeout(() => {
    readyToSave = true;
    lastSavedBounds = restorableWindowBounds(window);
  }, 1000);

  window.on('close', () => {
    clearTimeout(saveTimer);
    saveWindowState(window);
  });
}

// Creates one application window using the resolved user configuration.
function createWindow() {
  const windowConfig = runtimeConfig.config.window || {};
  nativeTheme.themeSource = windowConfig.themeSource || 'system';

  const window = new BrowserWindow({
    width: windowConfig.width,
    height: windowConfig.height,
    minWidth: windowConfig.minWidth,
    minHeight: windowConfig.minHeight,
    center: false,
    title: APP_NAME,
    icon: ICON_PATH,
    show: false,
    frame: windowConfig.frame === false ? false : true,
    backgroundColor: windowConfig.backgroundColor,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  installInputMethodHooks(window);
  installRendererDiagnostics(window);
  installWindowBoundsRestore(window, windowConfig);
  installWindowStatePersistence(window);
  window.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    query: DEBUG_KEYS ? { debugKeys: '1' } : {},
  });
}

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);
app.setPath('userData', profileDir());

// Loads user configuration before creating the first window.
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  applyApplicationIcon();

  try {
    runtimeConfig = loadConfig();
    runtimeConfig.config = applyRuntimeOverrides(runtimeConfig.config);
    appendDiagnostic(`loaded config ${runtimeConfig.configPath}`);
  } catch (error) {
    runtimeConfig = {
      config: {},
      configDir: path.join(os.homedir(), '.config', 'fpasoterm', 'User'),
      configPath: path.join(os.homedir(), '.config', 'fpasoterm', 'User', 'config.toml'),
      pluginUrls: [],
    };
    reportMainProcessError('Failed to load fpasoterm config', error);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Ensures shell processes are stopped when the final window closes.
app.on('window-all-closed', () => {
  for (const term of terminals.values()) {
    term.kill();
  }
  terminals.clear();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Creates a PTY for a renderer once xterm.js reports its initial size.
ipcMain.handle('terminal:start', (event, options) => {
  const existing = terminals.get(event.sender.id);
  if (existing) {
    return;
  }
  spawnTerminal(event.sender, options);
});

// Forwards keyboard/input data from xterm.js to the PTY.
ipcMain.on('terminal:write', (event, data) => {
  const term = terminals.get(event.sender.id);
  if (term) {
    term.write(data);
  }
});

// Applies renderer size changes to the PTY.
ipcMain.on('terminal:resize', (event, size) => {
  const term = terminals.get(event.sender.id);
  if (term && size.cols > 0 && size.rows > 0) {
    term.resize(size.cols, size.rows);
  }
});

// Copies accumulated diagnostics through the desktop clipboard API.
ipcMain.handle('diagnostics:copy', () => {
  const text = diagnostics.join('\n');
  clipboard.writeText(text);
  return text.length;
});

// Exposes the diagnostics log path to the renderer debug panel.
ipcMain.handle('diagnostics:path', () => diagnosticsPath);

// Sends resolved settings and plugin script URLs to the renderer.
ipcMain.handle('config:get', () => runtimeConfig);

// Closes the focused window from the custom titlebar close button.
ipcMain.handle('window:close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window && !window.isDestroyed()) {
    window.close();
  }
});
