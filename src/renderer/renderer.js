const terminalElement = document.getElementById('terminal');
const diagnosticsPanel = document.getElementById('diagnostics-panel');
const diagnosticsElement = document.getElementById('diagnostics');
const diagnosticsPathElement = document.getElementById('diagnostics-path');
const copyDiagnosticsButton = document.getElementById('copy-diagnostics');
const closeWindowButton = document.getElementById('close-window');
const minimizeWindowButton = document.getElementById('minimize-window');
const maximizeWindowButton = document.getElementById('maximize-window');
const syncMenu = document.getElementById('sync-menu');
const syncMenuToggleButton = document.getElementById('sync-menu-toggle');
const syncMenuItems = document.getElementById('sync-menu-items');
const syncCopyButton = document.getElementById('sync-copy');
const syncPasteButton = document.getElementById('sync-paste');
const syncDiagnosticsButton = document.getElementById('sync-diagnostics');
const webConsoleMenu = document.getElementById('web-console-menu');
const webConsoleToggleButton = document.getElementById('web-console-toggle');
const webConsoleItems = document.getElementById('web-console-items');
const webConsoleStartButton = document.getElementById('web-console-start');
const webConsoleCopyButton = document.getElementById('web-console-copy');
const webConsoleStopButton = document.getElementById('web-console-stop');
const terminalLogToggleButton = document.getElementById('terminal-log-toggle');
const windowTitleElement = document.getElementById('window-title');
const terminalMirrorElement = document.getElementById('terminal-mirror');
let debugKeys = new URLSearchParams(window.location.search).has('debugKeys');
const diagnosticLines = [];
let terminalMirrorText = '';
const fallbackConfig = {
  window: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    title: 'fpasoterm',
    titlebarColor: '#1565c0',
    titleLocked: true,
  },
  terminal: {
    allowTransparency: true,
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Noto Sans Mono CJK JP", monospace',
    fontSize: 14,
    backgroundOpacity: 0.8,
    scrollback: 1000,
    termName: 'xterm-256color',
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
  sync: {
    enabled: false,
    provider: 'folder',
    path: '',
    channel: 'default',
    clipboard: true,
    diagnostics: true,
    pasteRequiresConfirm: true,
    maxBytes: 1048576,
    ttlSeconds: 86400,
  },
  logging: {
    enabled: true,
    directory: '',
    autoStart: false,
    maxBytes: 10485760,
  },
  webConsole: {
    enabled: false,
    bind: '127.0.0.1',
    port: 0,
    ttlSeconds: 900,
    maxBytes: 1048576,
    allowTerminalInput: false,
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
let terminalResizeTimer = null;
let terminalDeferredResizeTimer = null;
let xtermOverlayObserver = null;
let pendingOscData = '';

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
    startTerminalLog: (path) => invoke('terminal_log_start', { request: { path: path || null } }),
    stopTerminalLog: () => invoke('terminal_log_stop'),
    terminalLogStatus: () => invoke('terminal_log_status'),
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
    applyConfigPath: (path) => invoke('config_apply_path', { path }),
    syncStatus: () => invoke('sync_status'),
    syncWriteClipboard: (text) => invoke('sync_write_clipboard', { request: { text } }),
    syncReadClipboard: () => invoke('sync_read_clipboard'),
    syncWriteDiagnostics: () => invoke('sync_write_diagnostics'),
    webConsoleStart: () => invoke('web_console_start'),
    webConsoleStop: () => invoke('web_console_stop'),
    webConsoleStatus: () => invoke('web_console_status'),
    closeWindow: () => invoke('window_close'),
    minimizeWindow: () => invoke('window_minimize'),
    toggleMaximizeWindow: () => invoke('window_toggle_maximize'),
    startWindowDrag: () => invoke('window_start_drag'),
    startWindowResizeDrag: (direction) => window.__TAURI__.window.getCurrentWindow().startResizeDragging(direction),
    saveWindowBounds: () => invoke('window_save_bounds'),
    getWindowBounds: () => invoke('window_get_bounds'),
    setWindowBounds: (bounds) => invoke('window_set_bounds', { bounds }),
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
  if (!fitAddon || !term) {
    return;
  }

  const beforeCols = term.cols;
  const beforeRows = term.rows;
  fitAddon.fit();
  showDebugDiagnostic(`terminal fit cols=${beforeCols}->${term.cols} rows=${beforeRows}->${term.rows}`);
  window.fpasoterm.resizeTerminal({ cols: term.cols, rows: term.rows }).catch((error) => {
    showDiagnostic(`terminal resize failed: ${error}`);
  });
}

// Coalesces rapid webview resize events so shells do not redraw prompts repeatedly.
function scheduleFitAndResize() {
  if (terminalResizeTimer) {
    clearTimeout(terminalResizeTimer);
  }
  terminalResizeTimer = setTimeout(() => {
    fitAndResize();
  }, 80);
}

// Re-runs fit after layout-affecting runtime changes have settled in the webview.
function scheduleDeferredFitAndResize() {
  scheduleFitAndResize();
  if (terminalDeferredResizeTimer) {
    clearTimeout(terminalDeferredResizeTimer);
  }
  terminalDeferredResizeTimer = setTimeout(async () => {
    await afterNextPaint();
    fitAndResize();
  }, 220);
}

// Waits for the webview to finish layout before measuring the terminal.
function afterNextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
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
    showDiagnostic(
      `renderer resolved config title=${appConfig.window?.title || ''} titlebarColor=${appConfig.window?.titlebarColor || ''} shell=${appConfig.terminal?.shell || ''}`,
    );
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
  const title = windowConfig.title || fallbackConfig.window.title;
  const titlebarColor = windowConfig.titlebarColor || fallbackConfig.window.titlebarColor;
  document.documentElement.style.background = background;
  document.body.style.background = background;
  document.title = title;
  if (windowTitleElement) {
    windowTitleElement.textContent = title;
  }
  document.documentElement.style.setProperty('--titlebar-background', titlebarColor);
  showDebugDiagnostic(`renderer applied window title=${title} titlebarColor=${titlebarColor}`);
}

// Normalizes opacity values to the CSS alpha range.
function normalizeOpacity(value) {
  const opacity = Number(value);
  if (!Number.isFinite(opacity)) {
    return undefined;
  }
  return Math.max(0, Math.min(1, opacity));
}

// Returns a color with the requested alpha for common rgb/rgba/hex config values.
function colorWithOpacity(color, opacity) {
  const alpha = normalizeOpacity(opacity);
  const source = String(color || '').trim();
  if (alpha === undefined || !source) {
    return source;
  }

  const rgbMatch = source.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)$/i);
  if (rgbMatch) {
    return `rgba(${Number(rgbMatch[1])}, ${Number(rgbMatch[2])}, ${Number(rgbMatch[3])}, ${alpha})`;
  }

  const shortHex = source.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (shortHex) {
    const red = parseInt(`${shortHex[1]}${shortHex[1]}`, 16);
    const green = parseInt(`${shortHex[2]}${shortHex[2]}`, 16);
    const blue = parseInt(`${shortHex[3]}${shortHex[3]}`, 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const hex = source.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) {
    return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${alpha})`;
  }

  return source;
}

// Builds a terminal theme whose background alpha follows terminal.backgroundOpacity.
function terminalThemeWithOpacity(terminalConfig) {
  const theme = { ...(terminalConfig.theme || {}) };
  if (terminalConfig.backgroundOpacity !== undefined && theme.background) {
    theme.background = colorWithOpacity(theme.background, terminalConfig.backgroundOpacity);
  }
  return theme;
}

// Applies runtime terminal options that xterm.js supports changing after open.
function applyTerminalAppearance() {
  if (!term) {
    return;
  }

  const terminalConfig = appConfig.terminal || {};
  for (const key of ['cursorBlink', 'cursorStyle', 'fontFamily', 'fontSize', 'scrollback']) {
    if (terminalConfig[key] !== undefined) {
      term.options[key] = terminalConfig[key];
    }
  }
  term.options.theme = terminalThemeWithOpacity(terminalConfig);
  scheduleDeferredFitAndResize();
}

// Applies a freshly loaded config to the live window and terminal.
async function applyRuntimeConfig(runtimeConfig) {
  appConfig = mergeConfig(fallbackConfig, runtimeConfig.config || {});
  pluginUrls = Array.isArray(runtimeConfig.pluginUrls) ? runtimeConfig.pluginUrls : [];
  imeDuplicateWindowMs = Number(appConfig.ime.duplicateWindowMs) || fallbackConfig.ime.duplicateWindowMs;
  imeRepeatedTextWindowMs =
    Number(appConfig.ime.repeatedTextWindowMs) || fallbackConfig.ime.repeatedTextWindowMs;
  imeDuplicateGuardEnabled = appConfig.ime.duplicateGuard !== false;
  applyWindowAppearance();
  applyTerminalAppearance();

  const width = Number(appConfig.window?.width);
  const height = Number(appConfig.window?.height);
  if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0) {
    await window.fpasoterm.setWindowBounds({ width, height });
    await afterNextPaint();
    fitAndResize();
    scheduleWindowStateSave();
  }

  showDiagnostic(`runtime config applied ${runtimeConfig.configPath}`);
}

// Loads and applies a config.toml path while the current terminal session keeps running.
async function applyRuntimeConfigPath(configPath) {
  const normalizedPath = String(configPath || '').trim();
  if (!normalizedPath) {
    showDiagnostic('ignored empty runtime config path');
    return;
  }

  try {
    const runtimeConfig = await window.fpasoterm.applyConfigPath(normalizedPath);
    await applyRuntimeConfig(runtimeConfig);
  } catch (error) {
    showDiagnostic(`runtime config apply failed path=${normalizedPath}: ${error}`);
  }
}

// Updates both the browser document title and the visible custom titlebar text.
function setRuntimeWindowTitle(title, options = {}) {
  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle) {
    return;
  }
  if (appConfig.window?.titleLocked && !options.force) {
    showDebugDiagnostic(`ignored shell title change while title is locked: ${normalizedTitle}`);
    return;
  }

  document.title = normalizedTitle;
  if (windowTitleElement) {
    windowTitleElement.textContent = normalizedTitle;
  }
}

// Applies a runtime titlebar color when the value is a valid CSS color.
function setRuntimeTitlebarColor(color) {
  const normalizedColor = String(color || '').trim();
  if (!normalizedColor || !CSS.supports('color', normalizedColor)) {
    showDiagnostic(`ignored invalid titlebar color: ${normalizedColor}`);
    return;
  }

  document.documentElement.style.setProperty('--titlebar-background', normalizedColor);
}

// Applies fpasoterm-specific OSC 777 commands emitted by shell scripts.
function applyFpasotermOsc(command) {
  const fields = String(command || '').split(';');
  const values = {};
  for (const field of fields) {
    const separator = field.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = field.slice(0, separator).trim();
    const value = field.slice(separator + 1).trim();
    values[key] = value;
    if (key === 'title') {
      setRuntimeWindowTitle(value, { force: true });
    } else if (key === 'titlebarColor') {
      setRuntimeTitlebarColor(value);
    } else if (key === 'opacity' || key === 'backgroundOpacity' || key === 'terminalOpacity') {
      const opacity = normalizeOpacity(value);
      if (opacity === undefined) {
        showDiagnostic(`ignored invalid terminal opacity: ${value}`);
      } else {
        appConfig = mergeConfig(appConfig, { terminal: { backgroundOpacity: opacity } });
        applyTerminalAppearance();
      }
    } else if (key === 'config' || key === 'configPath') {
      applyRuntimeConfigPath(value);
    }
  }

  if (values.log === 'start') {
    startTerminalOutputLog(values.logPath || values.path || '').catch((error) => {
      showDiagnostic(`terminal log start failed: ${error}`);
    });
  } else if (values.log === 'stop') {
    stopTerminalOutputLog().catch((error) => {
      showDiagnostic(`terminal log stop failed: ${error}`);
    });
  }
}

// Watches PTY output for custom runtime appearance commands before xterm draws it.
function processRuntimeOsc(data) {
  pendingOscData = `${pendingOscData}${data}`;
  const oscPattern = /\x1b\]777;([\s\S]*?)(?:\x07|\x1b\\)/g;
  let match;
  let lastMatchEnd = 0;
  while ((match = oscPattern.exec(pendingOscData)) !== null) {
    applyFpasotermOsc(match[1]);
    lastMatchEnd = oscPattern.lastIndex;
  }

  if (lastMatchEnd > 0) {
    pendingOscData = pendingOscData.slice(lastMatchEnd);
  }
  if (pendingOscData.length > 4096 || !pendingOscData.includes('\x1b]777;')) {
    pendingOscData = pendingOscData.slice(-64);
  }
}

// Removes xterm.js visual-only overlay DOM that can appear as fixed garbled text on macOS.
function removeXtermVisualOverlays() {
  if (!terminalElement) {
    return;
  }

  for (const element of terminalElement.querySelectorAll('.xterm-accessibility, .xterm-message')) {
    element.remove();
  }
}

// Emits canvas layout information when key/debug diagnostics are enabled.
function logXtermCanvasDiagnostics() {
  if (!debugKeys || !terminalElement) {
    return;
  }

  const canvases = [...terminalElement.querySelectorAll('canvas')].map((canvas, index) => {
    const rect = canvas.getBoundingClientRect();
    const style = window.getComputedStyle(canvas);
    return [
      `canvas[${index}]`,
      `class=${canvas.className || '(none)'}`,
      `width=${canvas.width}`,
      `height=${canvas.height}`,
      `rect=${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.left)},${Math.round(rect.top)}`,
      `display=${style.display}`,
      `visibility=${style.visibility}`,
      `opacity=${style.opacity}`,
      `z=${style.zIndex}`,
    ].join(' ');
  });
  showDebugDiagnostic(`xterm canvas diagnostics count=${canvases.length} ${canvases.join(' | ')}`);
}

// Emits visible DOM nodes containing repeated W text when diagnostics are enabled.
function logXtermTextDiagnostics() {
  if (!debugKeys || !terminalElement) {
    return;
  }

  const matches = [];
  const walker = document.createTreeWalker(terminalElement, NodeFilter.SHOW_TEXT);
  while (matches.length < 12) {
    const node = walker.nextNode();
    if (!node) {
      break;
    }
    const text = node.textContent || '';
    if (!/W{3,}/.test(text)) {
      continue;
    }
    const parent = node.parentElement;
    const rect = parent?.getBoundingClientRect();
    const style = parent ? window.getComputedStyle(parent) : undefined;
    matches.push([
      `tag=${parent?.tagName || '(none)'}`,
      `class=${parent?.className || '(none)'}`,
      `text=${text.slice(0, 80)}`,
      `rect=${rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.left)},${Math.round(rect.top)}` : '(none)'}`,
      `display=${style?.display || '(none)'}`,
      `visibility=${style?.visibility || '(none)'}`,
      `opacity=${style?.opacity || '(none)'}`,
      `z=${style?.zIndex || '(none)'}`,
    ].join(' '));
  }
  showDebugDiagnostic(`xterm text diagnostics repeated-w count=${matches.length} ${matches.join(' | ')}`);
}

// Keeps xterm accessibility/message overlays out of the DOM if xterm recreates them.
function installXtermOverlayPruner() {
  removeXtermVisualOverlays();
  if (!terminalElement || xtermOverlayObserver) {
    return;
  }

  xtermOverlayObserver = new MutationObserver(() => {
    removeXtermVisualOverlays();
  });
  xtermOverlayObserver.observe(terminalElement, {
    childList: true,
    subtree: true,
  });
}

// Creates xterm.js using the resolved terminal settings.
function createTerminal() {
  if (!terminalElement) {
    return;
  }

  term = new Terminal({
    ...appConfig.terminal,
    theme: terminalThemeWithOpacity(appConfig.terminal || {}),
    screenReaderMode: false,
  });
  if (typeof term.onTitleChange === 'function') {
    term.onTitleChange((title) => setRuntimeWindowTitle(title));
  }
  fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalElement);
  installXtermOverlayPruner();
  logXtermCanvasDiagnostics();
  logXtermTextDiagnostics();
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

// Returns true when sync-folder features are enabled in the resolved config.
function syncEnabled() {
  const sync = appConfig.sync || {};
  return sync.enabled === true && sync.provider === 'folder' && Boolean(String(sync.path || '').trim());
}

// Shows a short state label on a sync button, then restores the original text.
function flashSyncButton(button, label) {
  if (!button) {
    return;
  }
  const original = button.dataset.label || button.textContent;
  button.dataset.label = original;
  button.textContent = label;
  setTimeout(() => {
    button.textContent = button.dataset.label || original;
  }, 1400);
}

// Reads selected terminal text first, then falls back to the local clipboard.
async function textForSyncClipboard() {
  const selectedText = term?.getSelection?.() || '';
  if (selectedText) {
    return selectedText;
  }
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    showDiagnostic(`sync clipboard read failed: ${error}`);
    return '';
  }
}

// Publishes explicit text to the sync folder for another fpasoterm to pull.
async function syncCopyText() {
  const text = await textForSyncClipboard();
  if (!text) {
    flashSyncButton(syncCopyButton, 'Empty');
    showDiagnostic('sync copy skipped: no selected text or clipboard text');
    return;
  }
  const item = await window.fpasoterm.syncWriteClipboard(text);
  flashSyncButton(syncCopyButton, 'Synced');
  showDiagnostic(`sync clipboard wrote bytes=${item.text.length} channel=${item.channel}`);
}

// Pulls the latest sync clipboard item into the local OS clipboard.
async function syncPullClipboard() {
  const item = await window.fpasoterm.syncReadClipboard();
  if (!item?.text) {
    flashSyncButton(syncPasteButton, 'None');
    showDiagnostic('sync clipboard pull found no item');
    return;
  }
  await navigator.clipboard.writeText(item.text);
  flashSyncButton(syncPasteButton, 'Pulled');
  showDiagnostic(`sync clipboard pulled to OS clipboard bytes=${item.text.length} channel=${item.channel}`);
}

// Publishes the backend diagnostics ring buffer to the sync folder.
async function syncDiagnostics() {
  const item = await window.fpasoterm.syncWriteDiagnostics();
  flashSyncButton(syncDiagnosticsButton, item.text ? 'Synced' : 'Empty');
  showDiagnostic(`sync diagnostics wrote bytes=${item.text.length} channel=${item.channel}`);
}

// Enables sync controls only when [sync] is configured.
async function installSyncControls() {
  if (syncMenu) {
    syncMenu.hidden = true;
  }
  closeSyncMenu();
  if (!syncEnabled()) {
    return;
  }

  const status = await window.fpasoterm.syncStatus();
  if (!status.enabled) {
    showDiagnostic(`sync disabled: ${status.message}`);
    return;
  }

  if (syncMenu) {
    syncMenu.hidden = false;
  }
  showDiagnostic(`sync folder enabled channel=${status.channel} path=${status.path}`);
}

// Opens or closes the compact sync action menu in the custom titlebar.
function setSyncMenuOpen(open) {
  if (!syncMenuItems || !syncMenuToggleButton) {
    return;
  }
  syncMenuItems.hidden = !open;
  syncMenuToggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// Closes the sync menu after actions or outside clicks.
function closeSyncMenu() {
  setSyncMenuOpen(false);
}

// Returns true when the temporary web console controls should be available.
function webConsoleEnabled() {
  const webConsole = appConfig.webConsole || {};
  return webConsole.enabled === true;
}

// Enables the temporary web console controls only when configured or requested.
async function installWebConsoleControls() {
  if (webConsoleMenu) {
    webConsoleMenu.hidden = true;
  }
  closeWebConsoleMenu();
  if (!webConsoleEnabled()) {
    return;
  }
  const status = await window.fpasoterm.webConsoleStatus();
  if (webConsoleMenu) {
    webConsoleMenu.hidden = false;
  }
  updateWebConsoleButtons(status);
  showDiagnostic(`web console ${status.active ? 'active' : 'available'} ${status.message}`);
}

// Opens or closes the compact web console action menu.
function setWebConsoleMenuOpen(open) {
  if (!webConsoleItems || !webConsoleToggleButton) {
    return;
  }
  webConsoleItems.hidden = !open;
  webConsoleToggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// Closes the web console menu after actions or outside clicks.
function closeWebConsoleMenu() {
  setWebConsoleMenuOpen(false);
}

// Reflects the active read-only server state in the titlebar menu.
function updateWebConsoleButtons(status) {
  if (webConsoleStartButton) {
    webConsoleStartButton.disabled = status?.active === true;
  }
  if (webConsoleCopyButton) {
    webConsoleCopyButton.disabled = status?.active !== true || !status?.url;
  }
  if (webConsoleStopButton) {
    webConsoleStopButton.disabled = status?.active !== true;
  }
}

// Starts the read-only temporary web console.
async function startWebConsole() {
  const status = await window.fpasoterm.webConsoleStart();
  updateWebConsoleButtons(status);
  if (status.url) {
    await navigator.clipboard.writeText(status.url);
    showDiagnostic(`web console started url copied ${status.url}`);
  } else {
    showDiagnostic(`web console not started: ${status.message}`);
  }
  return status;
}

// Copies the active temporary web console URL to the OS clipboard.
async function copyWebConsoleUrl() {
  const status = await window.fpasoterm.webConsoleStatus();
  updateWebConsoleButtons(status);
  if (!status.active || !status.url) {
    showDiagnostic(`web console URL unavailable: ${status.message}`);
    return;
  }
  await navigator.clipboard.writeText(status.url);
  showDiagnostic(`web console URL copied ${status.url}`);
}

// Stops the temporary web console and invalidates the in-memory token.
async function stopWebConsole() {
  const status = await window.fpasoterm.webConsoleStop();
  updateWebConsoleButtons(status);
  showDiagnostic(status.message);
}

// Updates the terminal output log button label from backend state.
async function refreshTerminalLogControl() {
  if (!terminalLogToggleButton) {
    return;
  }
  const status = await window.fpasoterm.terminalLogStatus();
  terminalLogToggleButton.hidden = status.enabled === false;
  terminalLogToggleButton.textContent = status.active ? 'Log Stop' : 'Log Start';
  terminalLogToggleButton.dataset.active = status.active ? 'true' : 'false';
}

// Starts terminal output logging to the configured or requested file.
async function startTerminalOutputLog(path = '') {
  const status = await window.fpasoterm.startTerminalLog(path);
  await refreshTerminalLogControl();
  showDiagnostic(`terminal log started path=${status.path}`);
  return status;
}

// Stops terminal output logging and reports the final byte count.
async function stopTerminalOutputLog() {
  const status = await window.fpasoterm.stopTerminalLog();
  await refreshTerminalLogControl();
  showDiagnostic(`terminal log stopped path=${status.path} bytes=${status.bytesWritten}`);
  return status;
}

// Copies diagnostics even when terminal copy shortcuts are captured by xterm.js.
copyDiagnosticsButton.addEventListener('click', async () => {
  const copiedLength = await window.fpasoterm.copyDiagnostics();
  copyDiagnosticsButton.textContent = copiedLength > 0 ? 'Copied' : 'No Logs';
  setTimeout(() => {
    copyDiagnosticsButton.textContent = 'Copy';
  }, 1200);
});

syncCopyButton.addEventListener('click', () => {
  syncCopyText().catch((error) => {
    flashSyncButton(syncCopyButton, 'Error');
    showDiagnostic(`sync copy failed: ${error}`);
  }).finally(closeSyncMenu);
});

syncPasteButton.addEventListener('click', () => {
  syncPullClipboard().catch((error) => {
    flashSyncButton(syncPasteButton, 'Error');
    showDiagnostic(`sync pull failed: ${error}`);
  }).finally(closeSyncMenu);
});

syncDiagnosticsButton.addEventListener('click', () => {
  syncDiagnostics().catch((error) => {
    flashSyncButton(syncDiagnosticsButton, 'Error');
    showDiagnostic(`sync diagnostics failed: ${error}`);
  }).finally(closeSyncMenu);
});

syncMenuToggleButton.addEventListener('click', (event) => {
  event.stopPropagation();
  setSyncMenuOpen(syncMenuItems?.hidden !== false);
});

webConsoleStartButton.addEventListener('click', () => {
  startWebConsole().catch((error) => {
    showDiagnostic(`web console start failed: ${error}`);
  }).finally(closeWebConsoleMenu);
});

webConsoleCopyButton.addEventListener('click', () => {
  copyWebConsoleUrl().catch((error) => {
    showDiagnostic(`web console copy failed: ${error}`);
  }).finally(closeWebConsoleMenu);
});

webConsoleStopButton.addEventListener('click', () => {
  stopWebConsole().catch((error) => {
    showDiagnostic(`web console stop failed: ${error}`);
  }).finally(closeWebConsoleMenu);
});

webConsoleToggleButton.addEventListener('click', (event) => {
  event.stopPropagation();
  setWebConsoleMenuOpen(webConsoleItems?.hidden !== false);
});

document.addEventListener('pointerdown', (event) => {
  if (syncMenu && !syncMenu.hidden && !syncMenu.contains(event.target)) {
    closeSyncMenu();
  }
  if (webConsoleMenu && !webConsoleMenu.hidden && !webConsoleMenu.contains(event.target)) {
    closeWebConsoleMenu();
  }
});

terminalLogToggleButton.addEventListener('click', () => {
  const active = terminalLogToggleButton.dataset.active === 'true';
  const action = active ? stopTerminalOutputLog() : startTerminalOutputLog();
  action.catch((error) => {
    terminalLogToggleButton.textContent = 'Log Error';
    setTimeout(() => refreshTerminalLogControl().catch(() => {}), 1400);
    showDiagnostic(`terminal log toggle failed: ${error}`);
  });
});


// Closes the frameless window from the custom titlebar.
closeWindowButton.addEventListener('click', () => {
  window.fpasoterm.closeWindow();
});

// Minimizes the frameless window from the custom titlebar.
minimizeWindowButton.addEventListener('click', () => {
  window.fpasoterm.minimizeWindow?.().catch((error) => {
    showDiagnostic(`window minimize failed: ${error}`);
  });
});

// Toggles maximized state from the custom titlebar.
maximizeWindowButton.addEventListener('click', () => {
  window.fpasoterm.toggleMaximizeWindow?.().catch((error) => {
    showDiagnostic(`window maximize failed: ${error}`);
  });
});

// Starts native window dragging from the custom titlebar on Tauri.
document.getElementById('drag-region').addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('#window-controls')) {
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

// Uses the platform-native resize loop first so the window manager owns pointer capture.
async function startWindowResize(event, direction) {
  try {
    await window.fpasoterm.startWindowResizeDrag?.(direction);
  } catch (error) {
    showDiagnostic(`native window resize failed direction=${direction}: ${error}`);
    await startManualWindowResize(event, direction);
  }
}

// Resizes frameless windows without relying on platform-specific native hit testing.
async function startManualWindowResize(event, direction) {
  const initialBounds = await window.fpasoterm.getWindowBounds();
  const startX = event.screenX;
  const startY = event.screenY;
  const minWidth = Number(appConfig.window?.minWidth) || 420;
  const minHeight = Number(appConfig.window?.minHeight) || 260;
  let latestEvent = event;
  let applying = false;

  const applyResize = () => {
    applying = false;
    const deltaX = latestEvent.screenX - startX;
    const deltaY = latestEvent.screenY - startY;
    let x = initialBounds.x;
    let y = initialBounds.y;
    let width = initialBounds.width;
    let height = initialBounds.height;

    if (direction.includes('East')) {
      width = initialBounds.width + deltaX;
    }
    if (direction.includes('South')) {
      height = initialBounds.height + deltaY;
    }
    if (direction.includes('West')) {
      width = initialBounds.width - deltaX;
      x = initialBounds.x + deltaX;
    }
    if (direction.includes('North')) {
      height = initialBounds.height - deltaY;
      y = initialBounds.y + deltaY;
    }

    if (width < minWidth) {
      if (direction.includes('West')) {
        x = initialBounds.x + initialBounds.width - minWidth;
      }
      width = minWidth;
    }
    if (height < minHeight) {
      if (direction.includes('North')) {
        y = initialBounds.y + initialBounds.height - minHeight;
      }
      height = minHeight;
    }

    window.fpasoterm.setWindowBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    }).catch((error) => {
      showDiagnostic(`manual window resize failed direction=${direction}: ${error}`);
    });
  };

  const onPointerMove = (moveEvent) => {
    latestEvent = moveEvent;
    if (!applying) {
      applying = true;
      requestAnimationFrame(applyResize);
    }
  };
  const stopResize = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopResize);
    window.removeEventListener('pointercancel', stopResize);
    if (latestEvent !== event) {
      applyResize();
    }
    scheduleWindowStateSave();
    fitAndResize();
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', stopResize, { once: true });
  window.addEventListener('pointercancel', stopResize, { once: true });
}

// Adds native resize hit targets for the frameless transparent Tauri window.
for (const handle of document.querySelectorAll('[data-resize-direction]')) {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const direction = toTauriResizeDirection(handle.getAttribute('data-resize-direction'));
    startWindowResize(event, direction).catch((error) => {
      showDiagnostic(`manual window resize setup failed direction=${direction}: ${error}`);
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
  await installSyncControls();
  await installWebConsoleControls();
  await refreshTerminalLogControl();
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
    scheduleFitAndResize();
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
    processRuntimeOsc(data);
    mirrorTerminalData(data);
    term.write(data, () => {
      removeXtermVisualOverlays();
      logXtermCanvasDiagnostics();
      logXtermTextDiagnostics();
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
  await afterNextPaint();
  fitAddon.fit();
  try {
    await window.fpasoterm.startTerminal({ cols: term.cols, rows: term.rows });
    await refreshTerminalLogControl();
    await afterNextPaint();
    fitAndResize();
  } catch (error) {
    showTerminalError(`failed to start terminal backend: ${error.stack || error.message || error}`);
    return;
  }
  installCompositionDuplicateGuard();
  focusTerminalInput();
}

initialize();
