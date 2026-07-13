const terminalElement = document.getElementById('terminal');
const diagnosticsPanel = document.getElementById('diagnostics-panel');
const diagnosticsElement = document.getElementById('diagnostics');
const diagnosticsPathElement = document.getElementById('diagnostics-path');
const copyDiagnosticsButton = document.getElementById('copy-diagnostics');
const closeWindowButton = document.getElementById('close-window');
const terminalMirrorElement = document.getElementById('terminal-mirror');
let debugKeys = new URLSearchParams(window.location.search).has('debugKeys');
const diagnosticLines = [];
let terminalMirrorText = '';
const fallbackConfig = {
  window: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
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
};
let appConfig = fallbackConfig;
let pluginUrls = [];
let term;
let fitAddon;
let imeDuplicateWindowMs = fallbackConfig.ime.duplicateWindowMs;
let imeRepeatedTextWindowMs = fallbackConfig.ime.repeatedTextWindowMs;
let imeDuplicateGuardEnabled = fallbackConfig.ime.duplicateGuard;
let pendingCompositionData = '';
let recentCompositionCommit = null;
let recentPlainTextWrite = null;
let compositionRecentlyActiveUntil = 0;
let windowStateSaveTimer = null;

// Provides the renderer API shape expected by the rest of this file when the
// backend is injected by Tauri.
function installTauriApiAdapter() {
  if (window.fpasoterm || !window.__TAURI__) {
    return;
  }

  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;
  window.fpasoterm = {
    startTerminal: (size) => invoke('terminal_start', { size }),
    writeTerminal: (data) => invoke('terminal_write', { data }),
    resizeTerminal: (size) => invoke('terminal_resize', { size }),
    onTerminalData: (callback) => {
      return listen('terminal:data', (event) => callback(event.payload));
    },
    onTerminalExit: (callback) => {
      return listen('terminal:exit', (event) => callback(event.payload?.exitCode ?? 0));
    },
    onDiagnosticEvent: (callback) => {
      return listen('diagnostics:event', (event) => callback(event.payload));
    },
    copyDiagnostics: async () => {
      const text = await invoke('diagnostics_copy');
      await navigator.clipboard.writeText(text);
      return text.length;
    },
    getDiagnosticsPath: () => invoke('diagnostics_path'),
    logDiagnostic: (message) => invoke('diagnostics_log', { message }),
    getConfig: () => invoke('config_get'),
    closeWindow: () => invoke('window_close'),
    startWindowDrag: () => invoke('window_start_drag'),
    startWindowResizeDrag: (direction) => window.__TAURI__.window.getCurrentWindow().startResizeDragging(direction),
    saveWindowBounds: () => invoke('window_save_bounds'),
    getWindowBounds: () => invoke('window_get_bounds'),
    setWindowBounds: (bounds) => invoke('window_set_bounds', bounds),
  };
}

// Mirrors renderer exceptions to the main diagnostics pipeline via console capture.
window.addEventListener('error', (event) => {
  console.error(`renderer error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
});

// Mirrors failed async work to diagnostics instead of failing silently.
window.addEventListener('unhandledrejection', (event) => {
  console.error(`renderer unhandled rejection: ${event.reason}`);
});

// Fits xterm.js to the available element size and resizes the PTY.
function fitAndResize() {
  fitAddon.fit();
  window.fpasoterm.resizeTerminal({ cols: term.cols, rows: term.rows }).catch((error) => {
    showDiagnostic(`terminal resize failed: ${error}`);
  });
}

// Persists the current window size shortly after resize events settle.
function scheduleWindowStateSave() {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
  }
  windowStateSaveTimer = setTimeout(() => {
    window.fpasoterm.saveWindowBounds?.().catch((error) => {
      showDiagnostic(`window state save failed: ${error}`);
    });
  }, 250);
}

// Focuses both xterm.js and its hidden helper textarea used for IME input.
function focusTerminalInput() {
  if (!terminalElement || !term) {
    return;
  }
  term.focus();

  const textarea = terminalElement.querySelector('.xterm-helper-textarea');
  if (textarea) {
    textarea.focus({ preventScroll: true });
  }
}

// Returns true for printable text, excluding control sequences and escapes.
function isPlainTextInput(data) {
  return data.length > 0 && !/[\u0000-\u001f\u007f]/.test(data);
}

// Extends the time window in which duplicate IME text can be detected.
function markCompositionActivity() {
  compositionRecentlyActiveUntil = performance.now() + imeDuplicateWindowMs;
}

// Stores the latest in-progress composition text from the helper textarea.
function trackCompositionUpdate(event) {
  markCompositionActivity();
  if (event.data) {
    pendingCompositionData = event.data;
  }
}

// Records the committed composition text so xterm duplicate emissions can be filtered.
function trackCompositionCommit(event) {
  markCompositionActivity();
  const data = event.data || pendingCompositionData;
  pendingCompositionData = '';

  if (data && isPlainTextInput(data)) {
    recentCompositionCommit = {
      data,
      time: performance.now(),
      seen: false,
    };
  }
}

// Drops or corrects duplicate plain-text input produced around IME composition commits.
function correctCompositionData(data) {
  if (!imeDuplicateGuardEnabled || !isPlainTextInput(data)) {
    return data;
  }

  const now = performance.now();
  if (
    recentPlainTextWrite &&
    now <= compositionRecentlyActiveUntil &&
    data === recentPlainTextWrite.data &&
    now - recentPlainTextWrite.time <= imeRepeatedTextWindowMs
  ) {
    recentPlainTextWrite = null;
    return '';
  }

  if (!recentCompositionCommit) {
    return data;
  }

  if (now - recentCompositionCommit.time > imeDuplicateWindowMs) {
    recentCompositionCommit = null;
    return data;
  }

  if (data === recentCompositionCommit.data + recentCompositionCommit.data) {
    const correctedData = recentCompositionCommit.data;
    recentCompositionCommit = null;
    return correctedData;
  }

  if (data !== recentCompositionCommit.data) {
    return data;
  }

  if (!recentCompositionCommit.seen) {
    recentCompositionCommit.seen = true;
    return data;
  }

  recentCompositionCommit = null;
  return '';
}

// Hooks composition events on xterm's helper textarea for duplicate-input detection.
function installCompositionDuplicateGuard() {
  const textarea = terminalElement.querySelector('.xterm-helper-textarea');
  if (!textarea) {
    return;
  }

  textarea.addEventListener('compositionstart', () => {
    markCompositionActivity();
    pendingCompositionData = '';
    recentCompositionCommit = null;
  });
  textarea.addEventListener('compositionupdate', trackCompositionUpdate);
  textarea.addEventListener('compositionend', trackCompositionCommit);
}

// Writes a diagnostic line to the optional in-window diagnostics panel.
function appendDiagnosticLine(message) {
  if (!debugKeys) {
    return;
  }

  diagnosticLines.push(message);
  if (diagnosticLines.length > 80) {
    diagnosticLines.shift();
  }
  diagnosticsPanel.hidden = false;
  diagnosticsElement.value = diagnosticLines.join('\n');
  diagnosticsElement.scrollTop = diagnosticsElement.scrollHeight;
}

// Shows debug messages locally and mirrors renderer diagnostics to the backend.
function showDiagnostic(message) {
  console.error(message);
  window.fpasoterm?.logDiagnostic?.(message).catch(() => {});
  appendDiagnosticLine(message);
}

// Emits verbose diagnostics only when key/debug logging is enabled.
function showDebugDiagnostic(message) {
  if (debugKeys) {
    showDiagnostic(message);
  }
}

// Allows Tauri event listener registration to settle without blocking startup.
function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

// Converts control characters into visible markers for diagnostics output.
function printableDiagnosticData(data) {
  return data
    .replace(/\x1b/g, '<ESC>')
    .replace(/\r/g, '<CR>')
    .replace(/\n/g, '<LF>\n')
    .replace(/\t/g, '<TAB>');
}

// Mirrors PTY output outside xterm.js so renderer delivery can be verified.
function mirrorTerminalData(data) {
  if (!debugKeys || !terminalMirrorElement) {
    return;
  }

  terminalMirrorText += printableDiagnosticData(data);
  if (terminalMirrorText.length > 6000) {
    terminalMirrorText = terminalMirrorText.slice(-6000);
  }
  terminalMirrorElement.hidden = false;
  terminalMirrorElement.textContent = terminalMirrorText;
  terminalMirrorElement.scrollTop = terminalMirrorElement.scrollHeight;
}

// Writes a visible startup error into the terminal area when the backend fails.
function showTerminalError(message) {
  console.error(message);
  if (term) {
    term.writeln('');
    term.writeln(message);
    return;
  }

  terminalElement.textContent = message;
  terminalElement.classList.add('terminal-error');
}

// Deep-merges renderer fallback settings with main-process settings.
function mergeConfig(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return base;
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = base[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      merged[key] = mergeConfig(baseValue, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

// Fetches the resolved config and plugin URLs exposed by the backend API.
async function loadRuntimeConfig() {
  try {
    const runtimeConfig = await window.fpasoterm.getConfig();
    appConfig = mergeConfig(fallbackConfig, runtimeConfig.config || {});
    debugKeys = debugKeys || runtimeConfig.diagnostics?.debugKeys || runtimeConfig.diagnostics?.consoleDiagnostics;
    if (runtimeConfig.diagnostics?.opaqueTerminal) {
      appConfig = mergeConfig(appConfig, {
        window: { backgroundColor: '#101317' },
        terminal: {
          allowTransparency: false,
          theme: { background: '#101317' },
        },
      });
    }
    pluginUrls = Array.isArray(runtimeConfig.pluginUrls) ? runtimeConfig.pluginUrls : [];
    imeDuplicateWindowMs = Number(appConfig.ime.duplicateWindowMs) || fallbackConfig.ime.duplicateWindowMs;
    imeRepeatedTextWindowMs =
      Number(appConfig.ime.repeatedTextWindowMs) || fallbackConfig.ime.repeatedTextWindowMs;
    imeDuplicateGuardEnabled = appConfig.ime.duplicateGuard !== false;
    showDiagnostic(`renderer loaded config ${runtimeConfig.configPath}`);
  } catch (error) {
    console.error(`renderer failed to load config: ${error.stack || error.message || error}`);
    appConfig = fallbackConfig;
    pluginUrls = [];
  }
}

// Applies window-level visual settings that affect the renderer surface.
function applyWindowAppearance() {
  const windowConfig = appConfig.window || {};
  document.documentElement.classList.toggle('frameless-window', windowConfig.frame === false);
  const background = windowConfig.backgroundColor || fallbackConfig.window.backgroundColor;
  document.documentElement.style.background = background;
  document.body.style.background = background;
}

// Creates xterm.js using the resolved terminal settings.
function createTerminal() {
  if (!terminalElement) {
    return;
  }

  term = new Terminal(appConfig.terminal);
  fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalElement);
  showDebugDiagnostic(`terminal opened cols=${term.cols} rows=${term.rows}`);
}

// Remembers recent text sent to the PTY so a repeated IME emission can be dropped.
function rememberPlainTextWrite(data) {
  if (!isPlainTextInput(data)) {
    recentPlainTextWrite = null;
    return;
  }

  recentPlainTextWrite = {
    data,
    time: performance.now(),
  };
}

// Publishes the plugin API and loads enabled user plugins in order.
async function loadPlugins() {
  window.fpasotermPluginApi = Object.freeze({
    terminal: term,
    fitAddon,
    config: appConfig,
    log: (message) => showDiagnostic(`plugin: ${message}`),
  });

  for (const plugin of pluginUrls) {
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = plugin.url;
      script.async = false;
      script.onload = () => {
        showDiagnostic(`plugin loaded ${plugin.name}`);
        resolve();
      };
      script.onerror = () => {
        console.error(`failed to load plugin ${plugin.name}`);
        resolve();
      };
      document.head.appendChild(script);
    });
  }
}

// Copies diagnostics even when terminal copy shortcuts are captured by xterm.js.
copyDiagnosticsButton.addEventListener('click', async () => {
  const copiedLength = await window.fpasoterm.copyDiagnostics();
  copyDiagnosticsButton.textContent = copiedLength > 0 ? 'Copied' : 'No Logs';
  setTimeout(() => {
    copyDiagnosticsButton.textContent = 'Copy';
  }, 1200);
});

// Closes the frameless window from the custom titlebar.
closeWindowButton.addEventListener('click', () => {
  window.fpasoterm.closeWindow();
});

// Starts native window dragging from the custom titlebar on Tauri.
document.getElementById('drag-region').addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target === closeWindowButton) {
    return;
  }
  event.preventDefault();
  window.fpasoterm.startWindowDrag?.().catch((error) => {
    showDiagnostic(`window drag failed: ${error}`);
  });
});

// Converts DOM direction names into Tauri's native resize directions.
function toTauriResizeDirection(direction) {
  return direction
    .split(/(?=[A-Z])/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// Adds native resize hit targets for the frameless transparent Tauri window.
for (const handle of document.querySelectorAll('[data-resize-direction]')) {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const direction = toTauriResizeDirection(handle.getAttribute('data-resize-direction'));
    window.fpasoterm.startWindowResizeDrag?.(direction).catch((error) => {
      showDiagnostic(`window resize drag failed direction=${direction}: ${error}`);
    });
  });
}

// Initializes config, terminal, plugin loading, IPC handlers, and first PTY startup.
async function initialize() {
  installTauriApiAdapter();
  if (!window.fpasoterm) {
    showTerminalError('fpasoterm backend API is not available. Start the app through the Tauri runtime.');
    return;
  }
  await loadRuntimeConfig();
  if (debugKeys) {
    window.fpasoterm.getDiagnosticsPath().then((logPath) => {
      diagnosticsPathElement.textContent = logPath;
    });
  }
  applyWindowAppearance();
  createTerminal();

  if (!terminalElement || !term) {
    showDiagnostic('terminal element missing');
    return;
  }

  window.addEventListener('resize', () => {
    fitAndResize();
    scheduleWindowStateSave();
  });

  term.onData((data) => {
    showDebugDiagnostic(`renderer terminal input bytes=${data.length}`);
    const correctedData = correctCompositionData(data);

    if (!correctedData) {
      showDiagnostic(`renderer dropped duplicate composition data=${data}`);
      return;
    }

    if (correctedData !== data) {
      showDiagnostic(`renderer corrected duplicate composition data=${data} corrected=${correctedData}`);
    }

    rememberPlainTextWrite(correctedData);
    window.fpasoterm.writeTerminal(correctedData).catch((error) => {
      showTerminalError(`terminal write failed: ${error}`);
    });
  });

  Promise.resolve(window.fpasoterm.onTerminalData((data) => {
    showDebugDiagnostic(`renderer terminal data bytes=${data.length} preview=${printableDiagnosticData(data).slice(0, 160)}`);
    mirrorTerminalData(data);
    term.write(data, () => {
      showDebugDiagnostic(`renderer terminal write parsed bytes=${data.length}`);
    });
  })).catch((error) => {
    showDiagnostic(`terminal data listener failed: ${error}`);
  });
  showDebugDiagnostic('renderer terminal data listener requested');

  Promise.resolve(window.fpasoterm.onTerminalExit((exitCode) => {
    term.writeln('');
    term.writeln(`[process exited with code ${exitCode}]`);
  })).catch((error) => {
    showDiagnostic(`terminal exit listener failed: ${error}`);
  });

  Promise.resolve(window.fpasoterm.onDiagnosticEvent((event) => {
    const message = `${event.source}: ${event.message}`;
    console.error(message);
    appendDiagnosticLine(message);
  })).catch((error) => {
    showDiagnostic(`diagnostic listener failed: ${error}`);
  });

  for (const eventName of ['keydown', 'keyup', 'compositionstart', 'compositionupdate', 'compositionend']) {
    window.addEventListener(eventName, (event) => {
      const message =
        eventName.startsWith('composition')
          ? `renderer ${eventName} data=${event.data}`
          : `renderer ${eventName} key=${event.key} code=${event.code} composing=${event.isComposing}`;
      showDiagnostic(message);
    });
  }

  window.addEventListener('focus', focusTerminalInput);
  terminalElement.addEventListener('pointerdown', () => {
    setTimeout(focusTerminalInput, 0);
  });

  await loadPlugins();
  fitAddon.fit();
  await delay(250);
  try {
    await window.fpasoterm.startTerminal({ cols: term.cols, rows: term.rows });
  } catch (error) {
    showTerminalError(`failed to start terminal backend: ${error.stack || error.message || error}`);
    return;
  }
  installCompositionDuplicateGuard();
  focusTerminalInput();
}

initialize();
