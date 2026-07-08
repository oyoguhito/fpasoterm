const { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const pty = require('node-pty');

const APP_ID = 'io.github.oyoguhito.FpasoTerm';
const DEBUG_KEYS = process.env.FPASOTERM_DEBUG_KEYS === '1';
const DISABLE_GPU = process.env.FPASOTERM_DISABLE_GPU === '1';
const OZONE_PLATFORM = process.env.FPASOTERM_OZONE_PLATFORM || (process.platform === 'linux' ? 'x11' : undefined);
const ENABLE_WAYLAND_IME = process.env.FPASOTERM_ENABLE_WAYLAND_IME === '1';
const GTK_VERSION = process.env.FPASOTERM_GTK_VERSION;
const ENABLE_FEATURES = process.env.FPASOTERM_ENABLE_FEATURES;

const terminals = new Map();
const diagnostics = [];
const diagnosticsDir = path.join(process.cwd(), 'diagnostics');
const diagnosticsPath = path.join(diagnosticsDir, 'fpasoterm-debug.log');

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

function appendDiagnostic(message) {
  const line = `${new Date().toISOString()} ${message}`;
  diagnostics.push(line);
  if (diagnostics.length > 500) {
    diagnostics.shift();
  }

  console.error(message);

  try {
    fs.mkdirSync(diagnosticsDir, { recursive: true });
    fs.appendFileSync(diagnosticsPath, `${line}\n`);
  } catch (error) {
    console.error(`Failed to write diagnostics log: ${formatError(error)}`);
  }
}

function formatError(error) {
  if (error && error.stack) {
    return error.stack;
  }
  if (error && error.message) {
    return error.message;
  }
  return String(error);
}

function reportMainProcessError(title, error) {
  const message = formatError(error);
  appendDiagnostic(`${title}\n${message}`);

  if (app.isReady()) {
    dialog.showErrorBox(title, message);
  }
}

process.on('uncaughtException', (error) => {
  reportMainProcessError('Uncaught exception in FpasoTerm main process', error);
});

process.on('unhandledRejection', (reason) => {
  reportMainProcessError('Unhandled rejection in FpasoTerm main process', reason);
});

function shellCommand() {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'powershell.exe';
  }

  return process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
}

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

  term.onExit(({ exitCode }) => {
    terminals.delete(webContents.id);
    if (!webContents.isDestroyed()) {
      webContents.send('terminal:exit', exitCode);
    }
  });
}

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

function createWindow() {
  nativeTheme.themeSource = 'system';

  const window = new BrowserWindow({
    width: 1000,
    height: 680,
    minWidth: 420,
    minHeight: 260,
    title: 'FpasoTerm',
    backgroundColor: '#101317',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  installInputMethodHooks(window);
  installRendererDiagnostics(window);
  window.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    query: DEBUG_KEYS ? { debugKeys: '1' } : {},
  });
}

app.setName('FpasoTerm');
app.setAppUserModelId(APP_ID);

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  for (const term of terminals.values()) {
    term.kill();
  }
  terminals.clear();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('terminal:start', (event, options) => {
  const existing = terminals.get(event.sender.id);
  if (existing) {
    return;
  }
  spawnTerminal(event.sender, options);
});

ipcMain.on('terminal:write', (event, data) => {
  const term = terminals.get(event.sender.id);
  if (term) {
    term.write(data);
  }
});

ipcMain.on('terminal:resize', (event, size) => {
  const term = terminals.get(event.sender.id);
  if (term && size.cols > 0 && size.rows > 0) {
    term.resize(size.cols, size.rows);
  }
});

ipcMain.handle('diagnostics:copy', () => {
  const text = diagnostics.join('\n');
  clipboard.writeText(text);
  return text.length;
});

ipcMain.handle('diagnostics:path', () => diagnosticsPath);
