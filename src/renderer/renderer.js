const terminalElement = document.getElementById('terminal');
const diagnosticsPanel = document.getElementById('diagnostics-panel');
const diagnosticsElement = document.getElementById('diagnostics');
const diagnosticsPathElement = document.getElementById('diagnostics-path');
const copyDiagnosticsButton = document.getElementById('copy-diagnostics');
const closeWindowButton = document.getElementById('close-window');
const debugKeys = new URLSearchParams(window.location.search).has('debugKeys');
const diagnosticLines = [];
const fallbackConfig = {
  window: {
    backgroundColor: '#101317',
  },
  terminal: {
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Noto Sans Mono CJK JP", monospace',
    fontSize: 14,
    scrollback: 1000,
    theme: {
      background: '#101317',
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
  window.fpasoterm.resizeTerminal({ cols: term.cols, rows: term.rows });
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

// Shows debug messages in the optional in-window diagnostics panel.
function showDiagnostic(message) {
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

// Fetches the resolved config and plugin URLs exposed by the preload API.
async function loadRuntimeConfig() {
  try {
    const runtimeConfig = await window.fpasoterm.getConfig();
    appConfig = mergeConfig(fallbackConfig, runtimeConfig.config || {});
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

if (debugKeys) {
  window.fpasoterm.getDiagnosticsPath().then((logPath) => {
    diagnosticsPathElement.textContent = logPath;
  });
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

// Initializes config, terminal, plugin loading, IPC handlers, and first PTY startup.
async function initialize() {
  await loadRuntimeConfig();
  applyWindowAppearance();
  createTerminal();

  if (!terminalElement || !term) {
    showDiagnostic('terminal element missing');
    return;
  }

  window.addEventListener('resize', fitAndResize);

  term.onData((data) => {
    const correctedData = correctCompositionData(data);

    if (!correctedData) {
      showDiagnostic(`renderer dropped duplicate composition data=${data}`);
      return;
    }

    if (correctedData !== data) {
      showDiagnostic(`renderer corrected duplicate composition data=${data} corrected=${correctedData}`);
    }

    rememberPlainTextWrite(correctedData);
    window.fpasoterm.writeTerminal(correctedData);
  });

  window.fpasoterm.onTerminalData((data) => {
    term.write(data);
  });

  window.fpasoterm.onTerminalExit((exitCode) => {
    term.writeln('');
    term.writeln(`[process exited with code ${exitCode}]`);
  });

  window.fpasoterm.onDiagnosticEvent((event) => {
    showDiagnostic(`${event.source}: ${event.message}`);
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
  window.fpasoterm.startTerminal({ cols: term.cols, rows: term.rows });
  installCompositionDuplicateGuard();
  focusTerminalInput();
}

initialize();
