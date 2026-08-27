const terminalElement = document.getElementById('terminal');
const diagnosticsPanel = document.getElementById('diagnostics-panel');
const diagnosticsTitleElement = document.getElementById('diagnostics-title');
const diagnosticsElement = document.getElementById('diagnostics');
const fontGlyphPreviewElement = document.getElementById('font-glyph-preview');
const terminalCapabilityPreviewElement = document.getElementById('terminal-capability-preview');
const diagnosticsPathElement = document.getElementById('diagnostics-path');
const closeDiagnosticsButton = document.getElementById('close-diagnostics');
const terminalLogSelectElement = document.getElementById('terminal-log-select');
const terminalLogSearchElement = document.getElementById('terminal-log-search');
const terminalLogSearchNextButton = document.getElementById('terminal-log-search-next');
const terminalLogSearchStatusElement = document.getElementById('terminal-log-search-status');
const terminalLogShowSelectedButton = document.getElementById('terminal-log-show-selected');
const terminalLogDeleteSelectedButton = document.getElementById('terminal-log-delete-selected');
const terminalLogDeleteAllButton = document.getElementById('terminal-log-delete-all');
const checkForUpdatesButton = document.getElementById('check-for-updates');
const terminalLogConfirmElement = document.getElementById('terminal-log-confirm');
const terminalLogConfirmMessageElement = document.getElementById('terminal-log-confirm-message');
const terminalLogConfirmOkButton = document.getElementById('terminal-log-confirm-ok');
const terminalLogConfirmCancelButton = document.getElementById('terminal-log-confirm-cancel');
const closeWindowButton = document.getElementById('close-window');
const minimizeWindowButton = document.getElementById('minimize-window');
const maximizeWindowButton = document.getElementById('maximize-window');
const newWindowButton = document.getElementById('new-window');
const arrangeWindowButton = document.getElementById('arrange-window');
const closeAllWindowsButton = document.getElementById('close-all-windows');
const keyboardShortcutsHelpButton = document.getElementById('keyboard-shortcuts-help');
const closeAllConfirmElement = document.getElementById('close-all-confirm');
const closeAllConfirmMessageElement = document.getElementById('close-all-confirm-message');
const closeAllConfirmOkButton = document.getElementById('close-all-confirm-ok');
const closeAllConfirmCancelButton = document.getElementById('close-all-confirm-cancel');
const windowMenu = document.getElementById('window-menu');
const windowMenuToggleButton = document.getElementById('window-menu-toggle');
const windowMenuItems = document.getElementById('window-menu-items');
const keybindingPrefixElement = document.getElementById('keybinding-prefix');
const terminalLogStatusElement = document.getElementById('terminal-log-status');
const logMenuToggleButton = document.getElementById('log-menu-toggle');
const logMenuItems = document.getElementById('log-menu-items');
const terminalLogToggleButton = document.getElementById('terminal-log-toggle');
const terminalLogShowButton = document.getElementById('terminal-log-show');
const syncMenuToggleButton = document.getElementById('sync-menu-toggle');
const syncMenuItems = document.getElementById('sync-menu-items');
const syncStatusButton = document.getElementById('sync-status');
const syncCleanButton = document.getElementById('sync-clean');
const diagnosticsMenuToggleButton = document.getElementById('diagnostics-menu-toggle');
const diagnosticsMenuItems = document.getElementById('diagnostics-menu-items');
const fontGlyphTestButton = document.getElementById('font-glyph-test');
const terminalCapabilityTestButton = document.getElementById('terminal-capability-test');
const windowActionsMenuToggleButton = document.getElementById('window-actions-menu-toggle');
const windowActionsMenuItems = document.getElementById('window-actions-menu-items');
const pluginMenuSection = document.getElementById('plugin-menu-section');
const pluginMenuToggleButton = document.getElementById('plugin-menu-toggle');
const terminalKillButton = document.getElementById('terminal-kill');
const terminalCopyButton = document.getElementById('terminal-copy');
const terminalPasteButton = document.getElementById('terminal-paste');
const pluginCommandItems = document.getElementById('plugin-command-items');
const terminalBroadcastButton = document.getElementById('terminal-broadcast');
const terminalBroadcastDialog = document.getElementById('terminal-broadcast-dialog');
const terminalBroadcastTitle = document.getElementById('terminal-broadcast-title');
const terminalBroadcastText = document.getElementById('terminal-broadcast-text');
const terminalBroadcastControl = document.getElementById('terminal-broadcast-control');
const terminalBroadcastControlInsertButton = document.getElementById('terminal-broadcast-control-insert');
const terminalBroadcastControlStatus = document.getElementById('terminal-broadcast-control-status');
const terminalBroadcastTargetList = document.getElementById('terminal-broadcast-target-list');
const terminalBroadcastSelectAllButton = document.getElementById('terminal-broadcast-select-all');
const terminalBroadcastSelectNoneButton = document.getElementById('terminal-broadcast-select-none');
const terminalBroadcastSync = document.getElementById('terminal-broadcast-sync');
const terminalBroadcastSyncLabel = document.getElementById('terminal-broadcast-sync-label');
const terminalBroadcastSendButton = document.getElementById('terminal-broadcast-send');
const terminalBroadcastCancelButton = document.getElementById('terminal-broadcast-cancel');
const terminalBroadcastConfirmElement = document.getElementById('terminal-broadcast-confirm');
const terminalBroadcastConfirmMessageElement = document.getElementById('terminal-broadcast-confirm-message');
const terminalBroadcastConfirmOkButton = document.getElementById('terminal-broadcast-confirm-ok');
const terminalBroadcastConfirmCancelButton = document.getElementById('terminal-broadcast-confirm-cancel');
const windowTitleElement = document.getElementById('window-title');
const terminalMirrorElement = document.getElementById('terminal-mirror');
let debugKeys = new URLSearchParams(window.location.search).has('debugKeys');
const diagnosticLines = [];
let terminalMirrorText = '';
let closeAllConfirmResolver = null;
let terminalBroadcastConfirmResolver = null;
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
    fontFamily: '"DejaVu Sans Mono", "Noto Sans Mono", "Noto Sans Mono CJK JP", "Noto Sans Mono CJK KR", "Noto Sans Mono CJK SC", "NanumGothicCoding", "BIZ UDGothic", "Symbols Nerd Font Mono", "Symbols Nerd Font", "JetBrainsMono Nerd Font", "Noto Sans CJK JP", "Noto Sans CJK KR", "Noto Sans CJK SC", "Noto Sans CJK TC", "Hiragino Kaku Gothic ProN", "Apple SD Gothic Neo", "Malgun Gothic", Meiryo, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 14,
    lineHeight: 0.92,
    minimumContrastRatio: 1,
    rescaleOverlappingGlyphs: false,
    backgroundOpacity: 0.65,
    scrollback: 1000,
    termName: 'xterm-256color',
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
  },
  logging: {
    enabled: true,
    directory: '',
    autoStart: false,
    maxBytes: 10485760,
  },
};
let appConfig = fallbackConfig;
let activeConfigPath = '';
let pluginUrls = [];
let pluginVersion = 'unknown';
let pluginsReady = false;
let pluginReadyTimer = null;
let pluginReadyGeneration = 0;
const pluginReadyCallbacks = [];
const pluginCommands = new Map();
let term;
let fitAddon;
let imageAddon;
let terminalBroadcastTargets = [];
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
let diagnosticsPanelMode = 'diagnostics';
let syncDiagnosticsEnabled = false;
let syncDiagnosticsTimer = null;
let terminalLogSearchState = {
  query: '',
  text: '',
  matches: [],
  cursor: -1,
};
let terminalLogConfirmResolver = null;
let terminalLogConfirmReturnFocus = null;

// Resolves a configurable shortcut. A single key inherits keybindings.prefix;
// full values such as Ctrl+Alt+KeyN override the prefix for that action.
function keybindingSpec(name) {
  const defaults = fallbackConfig.keybindings;
  const settings = appConfig.keybindings || {};
  const configured = String(settings[name] ?? defaults[name] ?? '').trim() || defaults[name];
  const prefix = configuredKeybindingPrefix();
  if (configured.includes('+')) {
    return isValidFullKeybinding(configured) ? configured : `${prefix}+${defaults[name]}`;
  }
  return `${prefix}+${configured}`;
}

// Only modifier names may be used in the shared prefix. Key names such as
// Escape belong to an action binding, for example "Ctrl+Alt+Escape".
function isKeybindingModifier(token) {
  return ['ctrl', 'control', 'alt', 'option', 'shift', 'meta', 'cmd', 'command', 'mod']
    .includes(token.toLowerCase());
}

function keybindingTokens(value) {
  return String(value).split('+').map((token) => token.trim()).filter(Boolean);
}

function isValidKeybindingPrefix(value) {
  const tokens = keybindingTokens(value);
  return tokens.length > 0 && tokens.every(isKeybindingModifier);
}

function isValidFullKeybinding(value) {
  const tokens = keybindingTokens(value);
  return tokens.length > 1
    && tokens.slice(0, -1).every(isKeybindingModifier)
    && !isKeybindingModifier(tokens[tokens.length - 1]);
}

function configuredKeybindingPrefix() {
  const configured = String(appConfig.keybindings?.prefix ?? '').trim();
  return isValidKeybindingPrefix(configured) ? configured : fallbackConfig.keybindings.prefix;
}

// Matches the configured shortcut by key value or a physical KeyN-style code.
function matchesKeybinding(event, name) {
  const tokens = keybindingSpec(name).split('+').map((token) => token.trim()).filter(Boolean);
  const key = tokens.pop();
  if (!key) {
    return false;
  }
  const modifiers = new Set(tokens.map((token) => token.toLowerCase()));
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const wantsCtrl = modifiers.has('ctrl') || modifiers.has('control') || (modifiers.has('mod') && !isMac);
  const wantsMeta = modifiers.has('meta') || modifiers.has('cmd') || modifiers.has('command') || (modifiers.has('mod') && isMac);
  const wantsAlt = modifiers.has('alt') || modifiers.has('option');
  const wantsShift = modifiers.has('shift');
  if (event.ctrlKey !== wantsCtrl || event.metaKey !== wantsMeta || event.altKey !== wantsAlt || event.shiftKey !== wantsShift) {
    return false;
  }
  // Use event.code for layout-independent keys, including Space whose event.key
  // is a literal whitespace character and cannot be represented cleanly in TOML.
  const matches = /^(Key|Digit|Numpad|F\d|Arrow|Space$)/i.test(key)
    ? event.code.toLowerCase() === key.toLowerCase()
    : event.key.toLowerCase() === key.toLowerCase();
  if (matches && debugKeys && event.type === 'keydown') {
    showDebugDiagnostic(`shortcut matched action=${name} spec=${keybindingSpec(name)}`);
  }
  return matches;
}

// Produces the visible shortcut form used by menus and the Help panel.
function keybindingLabel(name) {
  return keybindingSpec(name).replace(/\bMod\b/g, navigator.platform.toLowerCase().includes('mac') ? 'Cmd' : 'Ctrl');
}

// Returns the compact action-key label used in the constrained titlebar menu.
function keybindingActionLabel(name) {
  const key = keybindingSpec(name).split('+').map((token) => token.trim()).filter(Boolean).pop() || '';
  const physicalLetter = /^Key([A-Z])$/i.exec(key);
  const physicalDigit = /^Digit([0-9])$/i.exec(key);
  return physicalLetter?.[1].toUpperCase() || physicalDigit?.[1] || key;
}

// Resolves the common prefix separately so each menu item can stay compact.
function keybindingPrefixLabel() {
  const prefix = configuredKeybindingPrefix();
  return prefix.replace(/\bMod\b/g, navigator.platform.toLowerCase().includes('mac') ? 'Cmd' : 'Ctrl');
}

// Keeps menu labels and accessibility metadata aligned with config.toml.
function applyKeybindingLabels() {
  const items = [
    [terminalLogToggleButton, 'logToggle', 'Log Start'],
    [terminalLogShowButton, 'logShow', 'Log Show'],
    [terminalBroadcastButton, 'broadcast', 'Broadcast'],
    [terminalKillButton, 'kill', 'Kill'],
    [terminalCopyButton, 'copy', 'Copy'],
    [terminalPasteButton, 'paste', 'Paste'],
    [newWindowButton, 'newWindow', 'New'],
    [arrangeWindowButton, 'tile', 'Tile'],
    [closeAllWindowsButton, 'closeAll', 'Close All'],
    [keyboardShortcutsHelpButton, 'help', 'Help'],
  ];
  for (const [element, action, label] of items) {
    if (!element) {
      continue;
    }
    const shortcut = keybindingLabel(action);
    element.setAttribute('aria-keyshortcuts', shortcut);
    if (element !== terminalLogToggleButton || element.dataset.active !== 'true') {
      element.textContent = `${label} (${keybindingActionLabel(action)})`;
    }
  }
  if (keybindingPrefixElement) {
    keybindingPrefixElement.textContent = `Shortcut prefix: ${keybindingPrefixLabel()}`;
    const configured = String(appConfig.keybindings?.prefix ?? '').trim();
    keybindingPrefixElement.title = configured && !isValidKeybindingPrefix(configured)
      ? `Invalid prefix \"${configured}\"; using ${keybindingPrefixLabel()}`
      : '';
  }
  if (windowMenuToggleButton) {
    windowMenuToggleButton.setAttribute('aria-keyshortcuts', `${keybindingLabel('menu')} ${keybindingLabel('logMenu')}`);
  }
}

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
    killTerminal: () => invoke('terminal_kill'),
    broadcastTerminal: (text, includeSync, targetInstanceIds) => invoke('terminal_broadcast', {
      request: { text, includeSync, targetInstanceIds },
    }),
    terminalBroadcastTargets: () => invoke('terminal_broadcast_targets'),
    resizeTerminal: (size) => invoke('terminal_resize', { size }),
    startTerminalLog: (path) => invoke('terminal_log_start', { request: { path: path || null } }),
    stopTerminalLog: () => invoke('terminal_log_stop'),
    terminalLogStatus: () => invoke('terminal_log_status'),
    listTerminalLogs: () => invoke('terminal_log_list'),
    showTerminalLog: (path) => invoke('terminal_log_show', { request: { path: path || null } }),
    clearTerminalLog: () => invoke('terminal_log_clear'),
    deleteTerminalLog: (path) => invoke('terminal_log_delete', { request: { path: path || null } }),
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
      return writeClipboardText(text);
    },
    getDiagnosticsPath: () => invoke('diagnostics_path'),
    logDiagnostic: (message) => invoke('diagnostics_log', { message }),
    readClipboard: () => invoke('clipboard_read'),
    writeClipboard: (text) => invoke('clipboard_write', { text }),
    getAppVersion: () => invoke('app_version'),
    checkForUpdate: () => invoke('update_check'),
    getPluginCatalog: () => invoke('plugin_catalog'),
    getTerminalCapabilities: () => invoke('terminal_capabilities'),
    getConfig: () => invoke('config_get'),
    applyConfigPath: (path) => invoke('config_apply_path', { path }),
    syncStatus: () => invoke('sync_status'),
    syncClean: () => invoke('sync_clean'),
    syncWriteDiagnostics: () => invoke('sync_write_diagnostics'),
    closeWindow: () => invoke('window_close'),
    minimizeWindow: () => invoke('window_minimize'),
    toggleMaximizeWindow: () => invoke('window_toggle_maximize'),
    newWindow: () => invoke('window_new'),
    arrangeWindows: (screen) => invoke('window_arrange', { screen }),
    closeAllWindows: () => invoke('window_close_all'),
    confirmCloseAllWindows: () => invoke('window_confirm_close_all'),
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
  const size = terminalPtySize();
  showDebugDiagnostic(
    `terminal fit cols=${beforeCols}->${size.cols} rows=${beforeRows}->${size.rows} ` +
      `pixels=${size.pixelWidth}x${size.pixelHeight}`,
  );
  window.fpasoterm.resizeTerminal(size).catch((error) => {
    showDiagnostic(`terminal resize failed: ${error}`);
  });
}

// Reports both the xterm grid and its rendered pixel extent to the PTY.
// Kitty-aware applications use the pixel fields from TIOCSWINSZ to size images.
function terminalPtySize() {
  const rect = terminalElement?.getBoundingClientRect();
  return {
    cols: Math.max(1, term?.cols || 80),
    rows: Math.max(1, term?.rows || 24),
    pixelWidth: Math.min(65535, Math.max(1, Math.round(rect?.width || 1))),
    pixelHeight: Math.min(65535, Math.max(1, Math.round(rect?.height || 1))),
  };
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
  if (diagnosticsPanelMode !== 'terminal-log') {
    diagnosticsPanelMode = 'diagnostics';
    setTerminalLogPickerVisible(false);
  }
  showDiagnosticsTextArea();
  if (diagnosticsTitleElement) {
    diagnosticsTitleElement.textContent = 'Diagnostics';
  }
  diagnosticsPanel.hidden = false;
  diagnosticsElement.value = diagnosticLines.join('\n');
  diagnosticsElement.scrollTop = diagnosticsElement.scrollHeight;
}

// Restores the shared panel's regular text body after another diagnostics view.
function showDiagnosticsTextArea() {
  diagnosticsElement.hidden = false;
  if (checkForUpdatesButton) {
    checkForUpdatesButton.hidden = true;
  }
  if (fontGlyphPreviewElement) {
    fontGlyphPreviewElement.hidden = true;
  }
  if (terminalCapabilityPreviewElement) {
    terminalCapabilityPreviewElement.hidden = true;
  }
}

// Shows debug messages locally and mirrors renderer diagnostics to the backend.
function showDiagnostic(message) {
  console.error(message);
  window.fpasoterm?.logDiagnostic?.(message).catch(() => {});
  appendDiagnosticLine(message);
  scheduleSyncDiagnosticsWrite();
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

// Composes decomposed kana marks without changing half-width kana characters.
function normalizeJapaneseTerminalText(data) {
  return String(data || '').normalize('NFC');
}

function queueTerminalOutput(data) {
  const normalizedData = normalizeJapaneseTerminalText(data);
  showDebugDiagnostic(`renderer terminal data bytes=${normalizedData.length} preview=${printableDiagnosticData(normalizedData).slice(0, 160)}`);
  processRuntimeOsc(normalizedData);
  mirrorTerminalData(normalizedData);
  term.write(normalizedData, () => {
    removeXtermVisualOverlays();
    logXtermCanvasDiagnostics();
    logXtermTextDiagnostics();
    showDebugDiagnostic(`renderer terminal write parsed bytes=${normalizedData.length}`);
    schedulePluginsReadyAfterTerminalOutput(180);
  });
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

// Sends terminal input through the same duplicate guard and PTY write path.
function sendTerminalInput(data, source = 'input') {
  showDebugDiagnostic(`renderer terminal ${source} bytes=${data.length}`);
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
}

// Converts OS clipboard text into terminal paste input.
function normalizePasteText(text) {
  return String(text || '').replace(/\r\n/g, '\r').replace(/\n/g, '\r');
}

// Reads the OS clipboard in a user-triggered event and sends it to the shell.
// WebKitGTK owns the ChromeOS clipboard integration, so prefer its API before
// shell helpers such as wl-paste. A successful helper with an empty selection
// must not hide text that the WebView can read.
async function pasteClipboardToTerminal() {
  let text = '';
  const errors = [];
  try {
    if (navigator.clipboard?.readText) {
      text = await navigator.clipboard.readText();
    }
  } catch (browserError) {
    errors.push(`browser clipboard: ${browserError}`);
  }

  if (!text) {
    try {
      text = await window.fpasoterm.readClipboard();
    } catch (backendError) {
      errors.push(`backend clipboard: ${backendError}`);
    }
  }

  if (!text) {
    if (errors.length) {
      showDiagnostic(`terminal paste failed: ${errors.join('; ')}`);
    }
    showDiagnostic('terminal paste skipped: clipboard is empty');
    return;
  }
  sendTerminalInput(normalizePasteText(text), 'paste');
}

// Writes text through the WebView clipboard path used by the host desktop.
async function writeBrowserClipboardText(text) {
  if (!navigator.clipboard) {
    throw new Error('navigator.clipboard is unavailable');
  }
  if (typeof navigator.clipboard.write === 'function' && typeof window.ClipboardItem === 'function') {
    const item = new window.ClipboardItem({
      'text/plain': new Blob([text], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    return;
  }
  await navigator.clipboard.writeText(text);
}

// Writes text to both host WebView and backend clipboard paths when possible.
async function writeClipboardText(text) {
  const value = String(text || '');
  if (!value) {
    return 0;
  }

  const errors = [];
  let wrote = false;
  try {
    await writeBrowserClipboardText(value);
    wrote = true;
  } catch (browserError) {
    errors.push(`browser clipboard: ${browserError}`);
    showDiagnostic(`browser clipboard write failed: ${browserError}`);
  }

  try {
    await window.fpasoterm.writeClipboard(value);
    wrote = true;
  } catch (backendError) {
    errors.push(`backend clipboard: ${backendError}`);
    showDiagnostic(`backend clipboard write failed: ${backendError}`);
  }

  if (!wrote) {
    throw new Error(errors.join('; '));
  }
  return value.length;
}

// Returns the current selected terminal text, if any.
function selectedTerminalText() {
  if (!term || typeof term.hasSelection !== 'function' || !term.hasSelection()) {
    return '';
  }
  return term.getSelection();
}

// Returns diagnostics/log text when the panel has a focused text selection.
function selectedDiagnosticsClipboardText() {
  if (diagnosticsPanel.hidden) {
    return '';
  }
  const start = diagnosticsElement.selectionStart;
  const end = diagnosticsElement.selectionEnd;
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) {
    return '';
  }
  return diagnosticsElement.value.slice(start, end);
}

// Selects the text source that should be copied by a user copy gesture.
function selectedClipboardText() {
  return selectedDiagnosticsClipboardText() || selectedTerminalText();
}

// Copies the current xterm.js selection to the OS clipboard.
async function copyTerminalSelection() {
  const text = selectedClipboardText();
  if (!text) {
    showDiagnostic('terminal copy skipped: no selection');
    return 0;
  }
  const copiedLength = await writeClipboardText(text);
  showDiagnostic(`selection copied bytes=${copiedLength}`);
  return copiedLength;
}

// Returns true for editable UI controls other than xterm's hidden IME textarea.
// The xterm textarea must be treated as terminal focus so paste reaches the PTY.
function isNonTerminalEditableControl(element) {
  const terminalTextarea = terminalElement.querySelector('.xterm-helper-textarea');
  return (
    Boolean(element) &&
    element !== terminalTextarea &&
    element.matches?.('input, textarea, select, button, [contenteditable="true"]')
  );
}

// Installs explicit paste handling for desktop webviews where xterm defaults can be skipped.
function installTerminalPasteHandlers() {
  let terminalPasteFallbackTimer = null;

  // Keep Ctrl+C available when a terminal graphics layer has displaced xterm focus.
  // Normal xterm input handles it while the helper textarea owns focus, so this
  // capture listener only provides the otherwise-unreachable fallback path.
  window.addEventListener('keydown', (event) => {
    const isInterrupt =
      event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !event.metaKey &&
      event.key.toLowerCase() === 'c';
    if (!isInterrupt) {
      return;
    }

    const textarea = terminalElement.querySelector('.xterm-helper-textarea');
    if (document.activeElement === textarea) {
      return;
    }

    const activeElement = document.activeElement;
    if (isNonTerminalEditableControl(activeElement)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    sendTerminalInput('\x03', 'interrupt fallback');
    setTimeout(focusTerminalInput, 0);
  }, true);

  // Let the native WebView create a paste event first. Its clipboardData is the
  // only reliable ChromeOS shared-clipboard path. Some WebKitGTK builds do not
  // dispatch it for Ctrl+Shift+V, so use the API fallback only after a short wait.
  window.addEventListener('keydown', (event) => {
    const isPaste = matchesKeybinding(event, 'paste');
    if (!isPaste) {
      return;
    }
    const activeElement = document.activeElement;
    if (isNonTerminalEditableControl(activeElement)) {
      return;
    }
    if (terminalPasteFallbackTimer) {
      clearTimeout(terminalPasteFallbackTimer);
    }
    terminalPasteFallbackTimer = setTimeout(() => {
      terminalPasteFallbackTimer = null;
      pasteClipboardToTerminal().catch((error) => {
        showDiagnostic(`terminal paste fallback failed: ${error}`);
      });
      focusTerminalInput();
    }, 120);
  }, true);

  const handleTerminalPaste = (event) => {
    if (terminalPasteFallbackTimer) {
      clearTimeout(terminalPasteFallbackTimer);
      terminalPasteFallbackTimer = null;
    }
    const activeElement = document.activeElement;
    if (isNonTerminalEditableControl(activeElement)) {
      return;
    }
    const text = event.clipboardData?.getData('text/plain') || '';
    if (!text) {
      // Some WebKitGTK clipboard events intentionally omit clipboardData.
      // Read through the same browser-first fallback path as the keyboard shortcut.
      event.preventDefault();
      event.stopImmediatePropagation();
      pasteClipboardToTerminal().catch((error) => {
        showDiagnostic(`terminal paste failed: ${error}`);
      });
      return;
    }
    event.preventDefault();
    // xterm.js also listens for paste below this capture listener. The terminal
    // must receive the native payload exactly once through sendTerminalInput().
    event.stopImmediatePropagation();
    sendTerminalInput(normalizePasteText(text), 'paste');
  };
  // Capture at the window so paste still works if a visual layer displaced focus.
  window.addEventListener('paste', handleTerminalPaste, true);

  terminalElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (term?.hasSelection?.()) {
      copyTerminalSelection().catch((error) => {
        showDiagnostic(`terminal context copy failed: ${error}`);
      });
      return;
    }
    pasteClipboardToTerminal().catch((error) => {
      showDiagnostic(`terminal context paste failed: ${error}`);
    });
  });

  window.addEventListener('keydown', (event) => {
    const isNewWindowShortcut = matchesKeybinding(event, 'newWindow');
    if (isNewWindowShortcut) {
      event.preventDefault();
      event.stopPropagation();
      window.fpasoterm.newWindow?.().catch((error) => showDiagnostic(`new window failed: ${error}`));
      return;
    }

    const isArrangeShortcut = matchesKeybinding(event, 'tile');
    if (isArrangeShortcut) {
      event.preventDefault();
      event.stopPropagation();
      window.fpasoterm.arrangeWindows?.(getAvailableScreenBounds())
        .then((message) => showDiagnostic(message))
        .catch((error) => showDiagnostic(`window arrange failed: ${error}`));
      return;
    }

    const isBroadcastShortcut = matchesKeybinding(event, 'broadcast');
    if (isBroadcastShortcut) {
      event.preventDefault();
      event.stopPropagation();
      openTerminalBroadcastDialog().catch((error) => showDiagnostic(`terminal broadcast dialog failed: ${error}`));
      return;
    }

    const isKillShortcut = matchesKeybinding(event, 'kill');
    if (isKillShortcut) {
      event.preventDefault();
      event.stopPropagation();
      window.fpasoterm.killTerminal().then(() => {
        showDiagnostic('terminal kill requested');
      }).catch((error) => {
        showDiagnostic(`terminal kill failed: ${error}`);
      });
      return;
    }

    const isCloseAllShortcut = matchesKeybinding(event, 'closeAll');
    if (isCloseAllShortcut) {
      event.preventDefault();
      event.stopPropagation();
      requestCloseAllWindows();
      return;
    }

    const isCopyShortcut = matchesKeybinding(event, 'copy');
    if (isCopyShortcut && selectedClipboardText()) {
      event.preventDefault();
      copyTerminalSelection().catch((error) => {
        showDiagnostic(`terminal copy failed: ${error}`);
      });
      return;
    }

    const isPasteShortcut = matchesKeybinding(event, 'paste');
    if (!isPasteShortcut) {
      return;
    }
    // The capture handler schedules a fallback. Do not cancel the native paste
    // action here or ChromeOS cannot provide event.clipboardData to the terminal.
  });

  window.addEventListener('copy', (event) => {
    const text = selectedClipboardText();
    if (!text) {
      return;
    }
    event.preventDefault();
    event.clipboardData?.setData('text/plain', text);
    event.clipboardData?.setData('text', text);
    window.fpasoterm.writeClipboard(text).then(() => {
      showDiagnostic(`selection copied via copy event bytes=${text.length}`);
    }).catch((error) => {
      showDiagnostic(`copy event backend write failed: ${error}`);
    });
  });
}

// Decodes the base64 payload used by terminal OSC 52 clipboard commands.
function decodeOsc52Text(encodedText) {
  const binary = atob(String(encodedText || ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Applies terminal OSC 52 clipboard write requests from tools such as multiplexers.
function applyOsc52Clipboard(selection, encodedText) {
  if (!encodedText) {
    return;
  }
  try {
    const text = decodeOsc52Text(encodedText);
    window.fpasoterm.writeClipboard(text).then(() => {
      showDiagnostic(`OSC 52 clipboard wrote bytes=${text.length} selection=${selection || 'clipboard'}`);
    }).catch((error) => {
      showDiagnostic(`OSC 52 clipboard write failed: ${error}`);
    });
  } catch (error) {
    showDiagnostic(`OSC 52 clipboard decode failed: ${error}`);
  }
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
    activeConfigPath = String(runtimeConfig.configPath || '');
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
    applyKeybindingLabels();
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
  for (const key of [
    'cursorBlink',
    'cursorStyle',
    'fontFamily',
    'fontSize',
    'lineHeight',
    'minimumContrastRatio',
    'rescaleOverlappingGlyphs',
    'scrollback',
  ]) {
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
  activeConfigPath = String(runtimeConfig.configPath || activeConfigPath);
  applyKeybindingLabels();
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

// Watches PTY output for runtime OSC commands before xterm draws it.
function processRuntimeOsc(data) {
  pendingOscData = `${pendingOscData}${data}`;
  const oscPattern = /\x1b\](\d+);([\s\S]*?)(?:\x07|\x1b\\)/g;
  let match;
  let lastMatchEnd = 0;
  while ((match = oscPattern.exec(pendingOscData)) !== null) {
    if (match[1] === '777') {
      applyFpasotermOsc(match[2]);
    } else if (match[1] === '52') {
      const separator = match[2].indexOf(';');
      if (separator !== -1) {
        applyOsc52Clipboard(match[2].slice(0, separator), match[2].slice(separator + 1));
      }
    }
    lastMatchEnd = oscPattern.lastIndex;
  }

  if (lastMatchEnd > 0) {
    pendingOscData = pendingOscData.slice(lastMatchEnd);
  }
  if (pendingOscData.length > 8192 || !/\x1b\](777|52);/.test(pendingOscData)) {
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
  const imageConfig = appConfig.terminal?.images || {};
  // ImageAddon can stall the current Tauri/WebKitGTK WebView on ChromeOS.
  // Keep the requested settings for future diagnostics, but do not load it.
  const graphicsEnabled = false;
  if (imageConfig.enabled === true) {
    showDiagnostic('terminal graphics are disabled in this build because ImageAddon can block input');
  }
  if (graphicsEnabled && window.ImageAddon?.ImageAddon) {
    imageAddon = new ImageAddon.ImageAddon({
      kittySupport: imageConfig.kittySupport === true,
      kittySizeLimit: Number(imageConfig.kittySizeLimit) || 32 * 1024 * 1024,
      storageLimit: Number(imageConfig.storageLimit) || 64,
      sixelSupport: imageConfig.sixelSupport === true,
      iipSupport: imageConfig.iipSupport === true,
    });
    term.loadAddon(imageAddon);
    // Image layers are added asynchronously. Keep IME and keyboard input on xterm.
    if (typeof imageAddon.onImageAdded === 'function') {
      imageAddon.onImageAdded(() => requestAnimationFrame(focusTerminalInput));
    }
  } else if (graphicsEnabled) {
    showDiagnostic('xterm image addon is unavailable; terminal graphics are disabled');
  }
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

// Converts a trusted file URL from the config resolver into Tauri's scoped
// asset protocol URL. This keeps local plugins compatible with the WebView CSP.
function pluginScriptSource(plugin) {
  const fileUrl = String(plugin?.url || '');
  const convertFileSrc = window.__TAURI__?.core?.convertFileSrc;
  if (!fileUrl.startsWith('file:') || typeof convertFileSrc !== 'function') {
    return fileUrl;
  }
  try {
    let filePath = decodeURIComponent(new URL(fileUrl).pathname);
    if (/^\/[A-Za-z]:\//.test(filePath)) {
      filePath = filePath.slice(1);
    }
    return convertFileSrc(filePath);
  } catch (error) {
    showDiagnostic(`plugin URL conversion failed for ${plugin?.name || 'unknown'}: ${error?.message || error}`);
    return fileUrl;
  }
}

// Publishes the plugin API and loads enabled user plugins in order.
async function loadPlugins() {
  window.fpasotermPluginApi = Object.freeze({
    version: pluginVersion,
    terminal: term,
    fitAddon,
    imageAddon,
    config: appConfig,
    log: (message) => showDiagnostic(`plugin: ${message}`),
    getOfficialPluginIndex: () => window.fpasoterm.getPluginCatalog(),
    onReady: registerPluginReadyCallback,
    registerCommand: registerPluginCommand,
  });

  for (const plugin of pluginUrls) {
    await new Promise((resolve) => {
      const commandCountBeforeLoad = pluginCommands.size;
      const script = document.createElement('script');
      const source = pluginScriptSource(plugin);
      script.src = source;
      script.async = false;
      script.onload = () => {
        const registeredCommandCount = pluginCommands.size - commandCountBeforeLoad;
        showDiagnostic(`plugin loaded ${plugin.name} commands=${registeredCommandCount} source=${source}`);
        resolve();
      };
      script.onerror = () => {
        const message = `failed to load plugin ${plugin.name} source=${source}`;
        console.error(message);
        showDiagnostic(message);
        resolve();
      };
      document.head.appendChild(script);
    });
  }
  updatePluginMenuVisibility();
}

// Shows Plugins only when at least one enabled plugin registered a command.
// Loading a plugin alone does not create a menu action because it has no handler.
function updatePluginMenuVisibility() {
  if (!pluginMenuSection || !pluginCommandItems) {
    return;
  }
  const hasCommands = pluginCommands.size > 0;
  pluginMenuSection.hidden = !hasCommands;
  if (!hasCommands) {
    pluginCommandItems.hidden = true;
    pluginMenuToggleButton?.setAttribute('aria-expanded', 'false');
  }
}

// Registers work that needs a successfully started PTY instead of only xterm.
function registerPluginReadyCallback(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('plugin onReady callback must be a function');
  }
  if (pluginsReady) {
    queueMicrotask(() => runPluginReadyCallback(callback));
    return;
  }
  pluginReadyCallbacks.push(callback);
}

// Runs one plugin callback without allowing a plugin error to stop the renderer.
function runPluginReadyCallback(callback) {
  Promise.resolve()
    .then(callback)
    .catch((error) => showDiagnostic(`plugin onReady failed: ${error?.stack || error}`));
}

// Schedules plugin startup after terminal output has become idle and painted.
// Shell initialization can clear the terminal after startTerminal() resolves,
// so notifying plugins directly at that point can erase their first writeln().
function schedulePluginsReadyAfterTerminalOutput(delayMs = 180) {
  if (pluginsReady) {
    return;
  }
  const generation = ++pluginReadyGeneration;
  if (pluginReadyTimer) {
    clearTimeout(pluginReadyTimer);
  }
  pluginReadyTimer = setTimeout(() => {
    pluginReadyTimer = null;
    afterNextPaint().then(() => {
      if (generation === pluginReadyGeneration) {
        notifyPluginsReady();
      }
    });
  }, delayMs);
}

// Delivers the terminal-ready lifecycle event once after initial PTY output settles.
function notifyPluginsReady() {
  if (pluginsReady) {
    return;
  }
  pluginsReady = true;
  for (const callback of pluginReadyCallbacks.splice(0)) {
    runPluginReadyCallback(callback);
  }
}

// Adds a trusted plugin action to the existing keyboard-accessible window menu.
function registerPluginCommand(id, title, handler) {
  const commandId = String(id || '').trim();
  const commandTitle = String(title || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9._:-]{0,79}$/.test(commandId)) {
    throw new Error('plugin command id must start with a letter and use letters, numbers, ., _, :, or -');
  }
  if (!commandTitle || commandTitle.length > 80) {
    throw new Error('plugin command title must contain 1 to 80 characters');
  }
  if (typeof handler !== 'function') {
    throw new TypeError('plugin command handler must be a function');
  }
  if (pluginCommands.has(commandId)) {
    throw new Error(`plugin command is already registered: ${commandId}`);
  }
  if (!pluginMenuSection || !pluginCommandItems) {
    throw new Error('plugin command menu is unavailable');
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.role = 'menuitem';
  button.textContent = commandTitle;
  button.dataset.pluginCommand = commandId;
  button.addEventListener('click', () => runPluginCommand(commandId));
  pluginCommands.set(commandId, { handler, button });
  pluginCommandItems.appendChild(button);
  updatePluginMenuVisibility();
  showDiagnostic(`plugin command registered id=${commandId}`);
}

// Invokes a registered command and reports plugin failures without closing the app.
async function runPluginCommand(commandId) {
  const command = pluginCommands.get(commandId);
  if (!command) {
    return;
  }
  setWindowMenuOpen(false);
  try {
    await command.handler();
  } catch (error) {
    showDiagnostic(`plugin command ${commandId} failed: ${error?.stack || error}`);
  }
}

// Returns true when sync-folder features are enabled in the resolved config.
function syncEnabled() {
  const sync = appConfig.sync || {};
  return sync.enabled === true && sync.provider === 'folder' && Boolean(String(sync.path || '').trim());
}

// Remote Broadcast needs both an explicit opt-in and a secret shared by trusted devices.
function syncCommandsEnabled() {
  const sync = appConfig.sync || {};
  return syncEnabled() && sync.commands === true && String(sync.commandSecret || '').length >= 32;
}

// Publishes the backend diagnostics ring buffer without creating a feedback loop.
async function writeDiagnosticsSnapshot() {
  if (!syncDiagnosticsEnabled || !window.fpasoterm?.syncWriteDiagnostics) {
    return;
  }
  const item = await window.fpasoterm.syncWriteDiagnostics();
  console.error(`sync diagnostics auto-wrote bytes=${item.text.length} channel=${item.channel}`);
}

// Debounces diagnostics writes so sync folders are not updated on every line.
function scheduleSyncDiagnosticsWrite(delayMs = 1200) {
  if (!syncDiagnosticsEnabled) {
    return;
  }
  if (syncDiagnosticsTimer) {
    clearTimeout(syncDiagnosticsTimer);
  }
  syncDiagnosticsTimer = setTimeout(() => {
    writeDiagnosticsSnapshot().catch((error) => {
      console.error(`sync diagnostics auto-write failed: ${error}`);
    });
  }, delayMs);
}

// Enables automatic diagnostics sync only when [sync] is configured.
async function installSyncControls() {
  syncDiagnosticsEnabled = false;
  if (!syncEnabled()) {
    if (syncCleanButton) {
      syncCleanButton.disabled = true;
    }
    return;
  }

  const status = await window.fpasoterm.syncStatus();
  if (syncCleanButton) {
    syncCleanButton.disabled = !status.enabled;
  }
  if (!status.enabled) {
    showDiagnostic(`sync disabled: ${status.message}`);
    return;
  }

  syncDiagnosticsEnabled = true;
  showDiagnostic(`sync folder enabled channel=${status.channel} path=${status.path}`);
  scheduleSyncDiagnosticsWrite(0);
}

// Updates the terminal output log button label from backend state.
async function refreshTerminalLogControl() {
  if (!terminalLogToggleButton || !terminalLogStatusElement) {
    return;
  }
  const status = await window.fpasoterm.terminalLogStatus();
  terminalLogToggleButton.hidden = status.enabled === false;
  terminalLogShowButton.hidden = status.enabled === false;
  terminalLogToggleButton.textContent = `${status.active ? 'Log Stop' : 'Log Start'} (${keybindingActionLabel('logToggle')})`;
  terminalLogToggleButton.dataset.active = status.active ? 'true' : 'false';
  terminalLogStatusElement.hidden = !status.active;
}

// Returns nested menu sections with their disclosure control and child actions.
function windowMenuSubmenus() {
  return [
    { name: 'log', toggle: logMenuToggleButton, items: logMenuItems },
    { name: 'sync', toggle: syncMenuToggleButton, items: syncMenuItems },
    { name: 'diagnostics', toggle: diagnosticsMenuToggleButton, items: diagnosticsMenuItems },
    { name: 'plugins', toggle: pluginMenuToggleButton, items: pluginCommandItems },
    { name: 'window', toggle: windowActionsMenuToggleButton, items: windowActionsMenuItems },
  ].filter((submenu) => submenu.toggle && submenu.items);
}

// Expands one menu section and optionally focuses a visible action inside it.
function setWindowMenuSubmenuOpen(name, open, focusTarget) {
  const submenu = windowMenuSubmenus().find((candidate) => candidate.name === name);
  if (!submenu) {
    return;
  }
  submenu.items.hidden = !open;
  submenu.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  fitWindowMenuToViewport();
  if (open && focusTarget && !focusTarget.hidden && !focusTarget.disabled) {
    focusTarget.focus({ preventScroll: true });
  }
}

// Collapses sections whenever the parent popup is closed or reopened.
function closeWindowMenuSubmenus() {
  for (const submenu of windowMenuSubmenus()) {
    submenu.items.hidden = true;
    submenu.toggle.setAttribute('aria-expanded', 'false');
  }
}

// Finds the nested section containing a menu item, if any.
function windowMenuSubmenuForElement(element) {
  const container = element?.closest?.('[data-menu-submenu]');
  if (!container) {
    return undefined;
  }
  return windowMenuSubmenus().find((submenu) => container.dataset.menuSubmenu === submenu.name);
}

// Moves keyboard focus inside the compact window menu.
function focusWindowMenuItem(delta) {
  if (!windowMenuItems || windowMenuItems.hidden) {
    return;
  }
  const items = Array.from(windowMenuItems.querySelectorAll('button:not([hidden]):not(:disabled)'))
    .filter((item) => item.getClientRects().length > 0);
  if (items.length === 0) {
    return;
  }
  const currentIndex = items.indexOf(document.activeElement);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + delta + items.length) % items.length;
  items[nextIndex].focus();
}

// Keeps the popup within the actual WebView viewport. CSS viewport units alone
// can be stale briefly after a native resize on WebKitGTK.
function fitWindowMenuToViewport() {
  if (!windowMenuItems || windowMenuItems.hidden) {
    return;
  }
  const top = windowMenuItems.getBoundingClientRect().top;
  const maximumHeight = Math.max(48, Math.floor(window.innerHeight - top - 8));
  windowMenuItems.style.maxHeight = `${maximumHeight}px`;
}

// Lets a panel move within the current window without changing its saved bounds.
function enableFloatingPanelDrag(panel, handle) {
  if (!panel || !handle) {
    return;
  }
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button, input, select, textarea, label')) {
      return;
    }
    const bounds = panel.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left;
    const offsetY = event.clientY - bounds.top;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = `${Math.max(0, bounds.left)}px`;
    panel.style.top = `${Math.max(0, bounds.top)}px`;
    const move = (moveEvent) => {
      const current = panel.getBoundingClientRect();
      const left = Math.max(0, Math.min(window.innerWidth - current.width, moveEvent.clientX - offsetX));
      const top = Math.max(0, Math.min(window.innerHeight - current.height, moveEvent.clientY - offsetY));
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(top)}px`;
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
    event.preventDefault();
  });
}

enableFloatingPanelDrag(diagnosticsPanel, diagnosticsPanel?.querySelector('[data-panel-drag-handle]'));
enableFloatingPanelDrag(terminalBroadcastDialog, terminalBroadcastTitle);

// Returns focusable controls in the visible diagnostics/log panel.
function diagnosticsPanelFocusItems() {
  if (!diagnosticsPanel || diagnosticsPanel.hidden) {
    return [];
  }
  if (terminalLogConfirmElement && !terminalLogConfirmElement.hidden) {
    return [
      terminalLogConfirmOkButton,
      terminalLogConfirmCancelButton,
    ].filter((element) => element && !element.hidden && !element.disabled);
  }
  return [
    terminalLogSelectElement,
    terminalLogSearchElement,
    terminalLogSearchNextButton,
    terminalLogShowSelectedButton,
    terminalLogDeleteSelectedButton,
    terminalLogDeleteAllButton,
    checkForUpdatesButton,
    closeDiagnosticsButton,
    diagnosticsElement,
    fontGlyphPreviewElement,
    terminalCapabilityPreviewElement,
  ].filter((element) => element && !element.hidden && !element.disabled);
}

// Moves focus inside the diagnostics/log panel without returning it to xterm.
function focusDiagnosticsPanelItem(delta) {
  const items = diagnosticsPanelFocusItems();
  if (items.length === 0) {
    return;
  }
  const currentIndex = items.indexOf(document.activeElement);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + delta + items.length) % items.length;
  items[nextIndex].focus({ preventScroll: true });
}

// Focuses the first useful log panel control after opening or refreshing logs.
function focusTerminalLogPanel() {
  if (!diagnosticsPanel || diagnosticsPanel.hidden) {
    return;
  }
  const preferred = terminalLogSelectElement && !terminalLogSelectElement.hidden
    ? terminalLogSelectElement
    : closeDiagnosticsButton;
  preferred?.focus({ preventScroll: true });
}

// Selects the next or previous occurrence of the search text in the visible log textarea.
function scrollDiagnosticsSelectionIntoView(index) {
  const textBeforeMatch = diagnosticsElement.value.slice(0, index);
  const lineNumber = textBeforeMatch.split('\n').length - 1;
  const computedStyle = window.getComputedStyle(diagnosticsElement);
  const fontSize = Number.parseFloat(computedStyle.fontSize) || 12;
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || fontSize * 1.2;
  const targetTop = Math.max(0, lineNumber * lineHeight - diagnosticsElement.clientHeight / 2);
  diagnosticsElement.scrollTop = targetTop;
}

function searchTerminalLogText(direction = 1) {
  const query = String(terminalLogSearchElement?.value || '');
  if (!query) {
    terminalLogSearchState = { query: '', text: '', matches: [], cursor: -1 };
    if (terminalLogSearchStatusElement) {
      terminalLogSearchStatusElement.textContent = '';
    }
    terminalLogSearchElement?.focus({ preventScroll: true });
    return false;
  }

  const text = diagnosticsElement.value || '';
  const normalizedQuery = query.toLowerCase();
  const normalizedText = text.toLowerCase();
  const sameSearch =
    terminalLogSearchState.query === normalizedQuery &&
    terminalLogSearchState.text === normalizedText;

  if (!sameSearch) {
    const matches = [];
    let start = 0;
    while (start <= normalizedText.length) {
      const index = normalizedText.indexOf(normalizedQuery, start);
      if (index === -1) {
        break;
      }
      matches.push(index);
      start = index + Math.max(1, normalizedQuery.length);
    }
    terminalLogSearchState = {
      query: normalizedQuery,
      text: normalizedText,
      matches,
      cursor: -1,
    };
  }

  if (terminalLogSearchState.matches.length === 0) {
    terminalLogSearchState.cursor = -1;
    if (terminalLogSearchStatusElement) {
      terminalLogSearchStatusElement.textContent = '0/0';
    }
    showDiagnostic(`terminal log search not found: ${query}`);
    terminalLogSearchElement?.focus({ preventScroll: true });
    return false;
  }

  const delta = direction < 0 ? -1 : 1;
  terminalLogSearchState.cursor =
    (terminalLogSearchState.cursor + delta + terminalLogSearchState.matches.length) %
    terminalLogSearchState.matches.length;
  const index = terminalLogSearchState.matches[terminalLogSearchState.cursor];
  diagnosticsElement.focus({ preventScroll: true });
  diagnosticsElement.setSelectionRange(index, index + query.length);
  scrollDiagnosticsSelectionIntoView(index);
  if (terminalLogSearchStatusElement) {
    terminalLogSearchStatusElement.textContent = `${terminalLogSearchState.cursor + 1}/${terminalLogSearchState.matches.length}`;
  }
  showDiagnostic(`terminal log search matched: ${query} ${terminalLogSearchState.cursor + 1}/${terminalLogSearchState.matches.length}`);
  return true;
}

// Restores focus to a log-panel control after native confirmation dialogs close.
function restoreLogPanelFocus(element, options = {}) {
  if (!diagnosticsPanel || diagnosticsPanel.hidden) {
    return;
  }
  const fallback = terminalLogSelectElement?.options?.length > 0 ? terminalLogSelectElement : closeDiagnosticsButton;
  const target = element && !element.hidden && !element.disabled ? element : fallback;
  const focusTarget = () => {
    if (diagnosticsPanel.hidden) {
      return;
    }
    diagnosticsPanel.focus({ preventScroll: true });
    target?.focus({ preventScroll: true });
  };

  focusTarget();

  if (!options.repeat) {
    return;
  }

  afterNextPaint().then(() => {
    focusTarget();
  });
  for (const delay of [0, 50, 120, 240]) {
    setTimeout(focusTarget, delay);
  }
}

// Closes the in-panel confirmation dialog and resolves the pending action.
function resolveTerminalLogConfirm(confirmed) {
  if (!terminalLogConfirmElement || terminalLogConfirmElement.hidden) {
    return;
  }
  terminalLogConfirmElement.hidden = true;
  const resolver = terminalLogConfirmResolver;
  const returnFocus = terminalLogConfirmReturnFocus;
  terminalLogConfirmResolver = null;
  terminalLogConfirmReturnFocus = null;
  restoreLogPanelFocus(returnFocus, { repeat: true });
  resolver?.(confirmed);
}

// Shows an in-panel confirmation dialog so focus stays within the log panel.
function confirmTerminalLogAction(message, returnFocus) {
  if (!terminalLogConfirmElement || !terminalLogConfirmMessageElement || !terminalLogConfirmOkButton) {
    showDiagnostic('terminal log confirmation UI is unavailable');
    return Promise.resolve(false);
  }

  if (terminalLogConfirmResolver) {
    resolveTerminalLogConfirm(false);
  }

  terminalLogConfirmMessageElement.textContent = message;
  terminalLogConfirmReturnFocus = returnFocus;
  terminalLogConfirmElement.hidden = false;
  terminalLogConfirmOkButton.focus({ preventScroll: true });
  return new Promise((resolve) => {
    terminalLogConfirmResolver = resolve;
  });
}

// Shows a separate confirmation dialog before broadcasting a close-all request.
function confirmCloseAllWindows() {
  if (!closeAllConfirmElement || !closeAllConfirmMessageElement || !closeAllConfirmOkButton) {
    showDiagnostic('close all confirmation UI is unavailable');
    return Promise.resolve(false);
  }
  closeAllConfirmMessageElement.textContent =
    'Close all running fpasoterm windows?\n\nThis will terminate every fpasoterm window.';
  closeAllConfirmElement.hidden = false;
  closeAllConfirmOkButton.focus({ preventScroll: true });
  return new Promise((resolve) => {
    closeAllConfirmResolver = resolve;
  });
}

// Resolves and hides the close-all confirmation dialog.
function resolveCloseAllWindows(confirmed) {
  if (!closeAllConfirmElement || closeAllConfirmElement.hidden) {
    return;
  }
  closeAllConfirmElement.hidden = true;
  const resolver = closeAllConfirmResolver;
  closeAllConfirmResolver = null;
  closeAllWindowsButton.focus({ preventScroll: true });
  resolver?.(confirmed);
}

// Asks for confirmation before closing all application instances.
function requestCloseAllWindows() {
  window.fpasoterm.confirmCloseAllWindows?.().catch((error) => {
    showDiagnostic(`close all confirmation failed: ${error}`);
  });
}

// Starts or stops terminal output logging from both button clicks and shortcuts.
function toggleTerminalOutputLog() {
  const active = terminalLogToggleButton.dataset.active === 'true';
  const action = active ? stopTerminalOutputLog() : startTerminalOutputLog();
  action.catch((error) => {
    terminalLogToggleButton.textContent = 'Error';
    setTimeout(() => refreshTerminalLogControl().catch(() => {}), 1400);
    showDiagnostic(`terminal log toggle failed: ${error}`);
  }).finally(() => setWindowMenuOpen(false));
}

// Opens the terminal log viewer from both button clicks and shortcuts.
function showTerminalOutputLogFromMenu() {
  showTerminalOutputLog().catch((error) => {
    terminalLogShowButton.textContent = 'Error';
    setTimeout(() => {
      terminalLogShowButton.textContent = 'Log Show (^P)';
    }, 1400);
    showDiagnostic(`terminal log show failed: ${error}`);
  }).finally(() => setWindowMenuOpen(false));
}

// Renders checkboxes for the live local terminals that can receive broadcast input.
function renderTerminalBroadcastTargets(targets) {
  terminalBroadcastTargets = Array.isArray(targets) ? targets : [];
  terminalBroadcastTargetList.replaceChildren();
  for (const target of terminalBroadcastTargets) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.instanceId = target.id;
    checkbox.addEventListener('change', refreshTerminalBroadcastSyncOption);
    label.append(checkbox, document.createTextNode(`${target.title} (pid ${target.pid})`));
    terminalBroadcastTargetList.append(label);
  }
  if (!terminalBroadcastTargets.length) {
    terminalBroadcastTargetList.textContent = 'No running local windows were found.';
  }
  refreshTerminalBroadcastSyncOption();
}

// Returns selected local IDs. An empty list deliberately means every instance.
function selectedTerminalBroadcastTargetIds() {
  const selected = [...terminalBroadcastTargetList.querySelectorAll('input[type="checkbox"]:checked')]
    .map((checkbox) => checkbox.dataset.instanceId)
    .filter(Boolean);
  return selected.length === terminalBroadcastTargets.length ? [] : selected;
}

// Allows sync delivery only when every local target is selected, so a local
// subset cannot unexpectedly be interpreted as a remote target subset.
function refreshTerminalBroadcastSyncOption() {
  const selectedCount = terminalBroadcastTargetList.querySelectorAll('input[type="checkbox"]:checked').length;
  const allSelected = terminalBroadcastTargets.length > 0 && selectedCount === terminalBroadcastTargets.length;
  const canSync = syncCommandsEnabled() && allSelected;
  terminalBroadcastSync.disabled = !canSync;
  terminalBroadcastSyncLabel.hidden = !syncEnabled();
  if (!canSync) {
    terminalBroadcastSync.checked = false;
  }
  terminalBroadcastSyncLabel.title = !syncCommandsEnabled()
    ? 'Run fpasoterm --setup-sync to configure a shared command secret.'
    : allSelected
      ? ''
      : 'Select all local windows before including the synced channel.';
}

// Shows a focused input dialog for selecting local targets and sending one command.
async function openTerminalBroadcastDialog() {
  if (!terminalBroadcastDialog || !terminalBroadcastText) {
    showDiagnostic('terminal broadcast dialog is unavailable');
    return;
  }
  setWindowMenuOpen(false);
  terminalBroadcastSync.checked = false;
  terminalBroadcastControl.value = '';
  terminalBroadcastControlStatus.textContent = '';
  terminalBroadcastTargetList.textContent = 'Loading local windows...';
  terminalBroadcastDialog.hidden = false;
  terminalBroadcastText.focus({ preventScroll: true });
  try {
    renderTerminalBroadcastTargets(await window.fpasoterm.terminalBroadcastTargets());
  } catch (error) {
    terminalBroadcastTargets = [];
    terminalBroadcastTargetList.textContent = `Could not list local windows: ${error}`;
    refreshTerminalBroadcastSyncOption();
  }
}

// Hides the broadcast dialog and restores direct terminal input focus.
function closeTerminalBroadcastDialog() {
  if (terminalBroadcastDialog) {
    terminalBroadcastDialog.hidden = true;
  }
  focusTerminalInput();
}

// Converts visible Broadcast control notation back into its terminal byte.
function decodeTerminalBroadcastControls(text) {
  const controls = {
    '\\x1b': '\x1b',
    '\\x09': '\t',
    '\\x03': '\x03',
    '\\x04': '\x04',
    '\\x18': '\x18',
    '\\x1a': '\x1a',
  };
  return String(text || '').replace(/\\x(?:1b|09|03|04|18|1a)/gi, (match) => controls[match.toLowerCase()] || match);
}

// Inserts visible notation for a terminal control byte, avoiding browser keys
// such as Escape and Tab while keeping pending Broadcast text inspectable.
function insertTerminalBroadcastControl() {
  const control = String(terminalBroadcastControl?.value || '');
  const controls = {
    tab: { text: '\\x09', label: 'Tab (0x09)' },
    'ctrl-c': { text: '\\x03', label: 'Ctrl+C (0x03)' },
    'ctrl-d': { text: '\\x04', label: 'Ctrl+D (0x04)' },
    'ctrl-x': { text: '\\x18', label: 'Ctrl+X (0x18)' },
    'ctrl-z': { text: '\\x1A', label: 'Ctrl+Z (0x1A)' },
    'alt-prefix': { text: '\\x1B', label: 'Alt prefix / Esc (0x1B)' },
  };
  const selected = controls[control];
  if (!selected || !terminalBroadcastText) {
    terminalBroadcastControlStatus.textContent = 'Select a control byte first.';
    return;
  }
  terminalBroadcastText.setRangeText(
    selected.text,
    terminalBroadcastText.selectionStart,
    terminalBroadcastText.selectionEnd,
    'end',
  );
  terminalBroadcastControlStatus.textContent = `Inserted ${selected.label}.`;
  terminalBroadcastControl.value = '';
  terminalBroadcastText.focus({ preventScroll: true });
}

// Identifies commands that are destructive enough to warrant a second click.
// This is a convenience warning, not a shell parser or a security boundary.
function dangerousBroadcastCommandLabels(text) {
  const command = String(text || '');
  const checks = [
    ['rm', /(?:^|[;|&\n]\s*)(?:sudo\s+)?(?:\S+\/)?rm(?:\s|$)/im],
    ['find -delete', /\bfind\b[^\r\n;|&]*\s-delete\b/i],
    ['git reset --hard', /\bgit\s+reset\s+(?:--hard|-H)\b/i],
    ['git clean -f', /\bgit\s+clean\b[^\r\n;|&]*(?:\s-f|--force)\b/i],
    ['filesystem formatting', /\b(?:mkfs(?:\.[A-Za-z0-9_-]+)?|wipefs)\b/i],
    ['dd output device', /\bdd\b[^\r\n;|&]*\bof=/i],
    ['truncate or shred', /\b(?:truncate|shred)\b/i],
    ['system shutdown', /\b(?:shutdown|poweroff|reboot|halt)\b/i],
  ];
  return checks.filter(([, pattern]) => pattern.test(command)).map(([label]) => label);
}

// Presents a focused confirmation before a potentially destructive Broadcast.
function confirmDangerousBroadcast(labels, text, targetCount, includesSync) {
  if (!terminalBroadcastConfirmElement || !terminalBroadcastConfirmMessageElement || !terminalBroadcastConfirmOkButton) {
    showDiagnostic('broadcast confirmation UI is unavailable');
    return Promise.resolve(false);
  }
  terminalBroadcastConfirmMessageElement.textContent = [
    'Potentially destructive command detected.',
    `Matches: ${labels.join(', ')}`,
    `Targets: ${targetCount} local window${targetCount === 1 ? '' : 's'}${includesSync ? ' and the synced channel' : ''}`,
    '',
    'Command:',
    text,
  ].join('\n');
  terminalBroadcastConfirmElement.hidden = false;
  terminalBroadcastConfirmOkButton.focus({ preventScroll: true });
  return new Promise((resolve) => {
    terminalBroadcastConfirmResolver = resolve;
  });
}

// Closes the Broadcast confirmation and returns focus to its editable command.
function resolveDangerousBroadcastConfirmation(confirmed) {
  if (!terminalBroadcastConfirmElement || terminalBroadcastConfirmElement.hidden) {
    return;
  }
  terminalBroadcastConfirmElement.hidden = true;
  const resolver = terminalBroadcastConfirmResolver;
  terminalBroadcastConfirmResolver = null;
  terminalBroadcastText?.focus({ preventScroll: true });
  resolver?.(confirmed);
}

// Writes the dialog text to local windows and optionally the configured sync channel.
async function sendTerminalBroadcast() {
  const rawText = String(terminalBroadcastText?.value || '');
  const text = rawText ? `${decodeTerminalBroadcastControls(normalizePasteText(rawText)).replace(/\r+$/, '')}\r` : '';
  if (!text) {
    showDiagnostic('terminal broadcast skipped: input is empty');
    terminalBroadcastText?.focus({ preventScroll: true });
    return;
  }
  const selectedCount = terminalBroadcastTargetList.querySelectorAll('input[type="checkbox"]:checked').length;
  if (!selectedCount) {
    showDiagnostic('terminal broadcast skipped: select at least one local window');
    return;
  }
  const warnings = dangerousBroadcastCommandLabels(rawText);
  if (warnings.length > 0) {
    const confirmed = await confirmDangerousBroadcast(
      warnings,
      rawText,
      selectedCount,
      Boolean(terminalBroadcastSync?.checked),
    );
    if (!confirmed) {
      showDiagnostic(`terminal broadcast cancelled: potentially destructive command (${warnings.join(', ')})`);
      return;
    }
  }
  const targetInstanceIds = selectedTerminalBroadcastTargetIds();
  const result = await window.fpasoterm.broadcastTerminal(
    text,
    Boolean(terminalBroadcastSync?.checked),
    targetInstanceIds,
  );
  showDiagnostic(result.message || `terminal broadcast requested bytes=${text.length}`);
  terminalBroadcastText.value = '';
  closeTerminalBroadcastDialog();
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

// Shows or hides the log picker controls in the diagnostics toolbar.
function setTerminalLogPickerVisible(visible) {
  for (const element of [
    terminalLogSelectElement,
    terminalLogSearchElement,
    terminalLogSearchNextButton,
    terminalLogSearchStatusElement,
    terminalLogShowSelectedButton,
    terminalLogDeleteSelectedButton,
    terminalLogDeleteAllButton,
  ]) {
    if (element) {
      element.hidden = !visible;
    }
  }
}

// Displays representative glyphs using the same configured font values as xterm.js.
function showFontGlyphTest() {
  if (!fontGlyphPreviewElement) {
    showDiagnostic('font glyph diagnostics panel is unavailable');
    return;
  }
  const terminalConfig = appConfig.terminal || {};
  const fontFamily = String(terminalConfig.fontFamily || fallbackConfig.terminal.fontFamily);
  const fontSize = Number(terminalConfig.fontSize) || fallbackConfig.terminal.fontSize;
  const lineHeight = Number(terminalConfig.lineHeight) || fallbackConfig.terminal.lineHeight;

  diagnosticsPanelMode = 'font-glyph-test';
  setTerminalLogPickerVisible(false);
  setWindowMenuOpen(false);
  diagnosticsTitleElement.textContent = 'Font / Glyph Diagnostics';
  diagnosticsElement.hidden = true;
  fontGlyphPreviewElement.hidden = false;
  if (terminalCapabilityPreviewElement) {
    terminalCapabilityPreviewElement.hidden = true;
  }
  fontGlyphPreviewElement.style.fontFamily = fontFamily;
  fontGlyphPreviewElement.style.fontSize = `${fontSize}px`;
  fontGlyphPreviewElement.style.lineHeight = String(lineHeight);
  fontGlyphPreviewElement.textContent = [
    'Configured terminal font',
    `fontFamily: ${fontFamily}`,
    `fontSize: ${fontSize}`,
    `lineHeight: ${lineHeight}`,
    '',
    'CJK: 日本語 漢字 ひらがな カタカナ 中文 한국어',
    'Half-width kana: ｱｲｳｴｵ ｶｯﾁｮｲ ﾊﾝｶｸ ｶﾀｶﾅ ｰﾞﾟ',
    'Box drawing: ┌─┬─┐ │ │ │ ├─┼─┤ │ │ │ └─┴─┘  ╔═╦═╗ ║ ║ ║ ╚═╩═╝',
    'Symbols: ← → ↑ ↓ ⇄ ✓ ✗ ★ ☆ ◆ ◇ ● ○ ± ≠ ≤ ≥',
    'Nerd Font (Powerline):   ',
    'Nerd Font (icons):  󰆍 󰘧 󰊢',
    'Nerd Font code points: U+E0A0 U+E0B0 U+E0B2 U+F423 U+F010D U+F0627 U+F02A2',
  ].join('\n');
  diagnosticsPathElement.textContent = `Config: ${activeConfigPath || '(default runtime config)'}`;
  diagnosticsPanel.hidden = false;
  fontGlyphPreviewElement.focus({ preventScroll: true });
}

// Shows the terminal environment and documented protocol behavior without
// emitting control sequences into the user's active shell session.
async function showTerminalCapabilityTest() {
  if (!terminalCapabilityPreviewElement) {
    showDiagnostic('terminal capability diagnostics panel is unavailable');
    return;
  }
  const capabilities = await window.fpasoterm.getTerminalCapabilities();
  diagnosticsPanelMode = 'terminal-capability-test';
  setTerminalLogPickerVisible(false);
  setWindowMenuOpen(false);
  diagnosticsTitleElement.textContent = 'Terminal Capability Diagnostics';
  diagnosticsElement.hidden = true;
  fontGlyphPreviewElement.hidden = true;
  terminalCapabilityPreviewElement.hidden = false;
  terminalCapabilityPreviewElement.textContent = [
    'Terminal environment',
    `TERM: ${capabilities.term}`,
    `COLORTERM: ${capabilities.colorterm}`,
    `locale: ${capabilities.locale}`,
    `shell: ${capabilities.shell}`,
    '',
    'Truecolor: advertised (xterm.js renderer)',
    "Test in terminal: printf '\\033[38;2;255;80;80mred \\033[38;2;80;220;140mgreen \\033[38;2;90;150;255mblue\\033[0m\\n'",
    'Expected: three visibly different RGB color words.',
    '',
    'OSC 52 clipboard: supported for received OSC 52 text payloads; writes OS clipboard.',
    'OSC 8 hyperlink: passed through to xterm.js; rendering and opening behavior depend on the webview.',
    'Bracketed paste: xterm.js input supports bracketed paste; shell/TUI enables it with DECSET 2004.',
    'Bell: BEL is passed to xterm.js; audible/visual feedback depends on OS and webview settings.',
  ].join('\n');
  diagnosticsPathElement.textContent = `Config: ${activeConfigPath || '(default runtime config)'}`;
  diagnosticsPanel.hidden = false;
  terminalCapabilityPreviewElement.focus({ preventScroll: true });
}

// Displays the application keyboard shortcuts in the existing accessible panel.
async function showKeyboardShortcutsHelp() {
  const version = await window.fpasoterm?.getAppVersion?.().catch(() => 'unknown') || 'unknown';
  diagnosticsPanelMode = 'keyboard-shortcuts';
  setTerminalLogPickerVisible(false);
  showDiagnosticsTextArea();
  setWindowMenuOpen(false);
  diagnosticsTitleElement.textContent = 'Keyboard Shortcuts';
  diagnosticsElement.value = [
    `fpasoterm ${version}`,
    `Config: ${activeConfigPath || 'unknown'}`,
    '',
    `${keybindingLabel('logMenu')}  Open the window menu at Log actions`,
    `${keybindingLabel('logToggle')}  Start or stop terminal output logging`,
    `${keybindingLabel('logShow')}  Show terminal output logs`,
    `${keybindingLabel('copy')}  Copy selected terminal or log text`,
    `${keybindingLabel('paste')}  Paste clipboard text into the terminal`,
    `${keybindingLabel('menu')}  Open or close the window menu`,
    `${keybindingLabel('help')}  Show this keyboard shortcut list`,
    `${keybindingLabel('newWindow')}  Open a new terminal window`,
    `${keybindingLabel('broadcast')}  Broadcast input to local windows or the synced channel`,
    `${keybindingLabel('kill')}  Kill the running terminal command and keep its shell open`,
    `${keybindingLabel('tile')}  Tile all fpasoterm windows`,
    `${keybindingLabel('closeAll')}  Close all fpasoterm windows after confirmation`,
    'Check for Updates  Compare this build with the npm latest release',
    'Escape        Close the current menu or panel',
  ].join('\n');
  diagnosticsElement.scrollTop = 0;
  diagnosticsPathElement.textContent = '';
  diagnosticsPanel.hidden = false;
  if (checkForUpdatesButton) {
    checkForUpdatesButton.hidden = false;
    checkForUpdatesButton.disabled = false;
    checkForUpdatesButton.textContent = 'Check for Updates';
    checkForUpdatesButton.focus({ preventScroll: true });
  } else {
    closeDiagnosticsButton.focus({ preventScroll: true });
  }
}

// Displays the configured sync folder, health checks, and discovered channels
// in the existing keyboard-accessible diagnostics panel.
async function showSyncStatus() {
  const status = await window.fpasoterm.syncStatus();
  diagnosticsPanelMode = 'sync-status';
  setTerminalLogPickerVisible(false);
  showDiagnosticsTextArea();
  setWindowMenuOpen(false);
  diagnosticsTitleElement.textContent = 'Sync Status';
  const lines = [
    `Status: ${status.enabled ? 'enabled' : 'disabled'}`,
    `Health: ${status.health || 'unknown'}`,
    `Provider: ${status.provider || 'folder'}`,
    `Path: ${status.path || '(not configured)'}`,
    `Channel: ${status.channel || '(not configured)'}`,
    `Root: exists=${Boolean(status.rootExists)} readable=${Boolean(status.rootReadable)} writable=${Boolean(status.rootWritable)}`,
    `Diagnostics: ${Boolean(status.diagnosticsExists)} (${Number(status.diagnosticsBytes || 0)} bytes)`,
    `Command directory: ${status.commandsPath || '(not available)'}`,
    `Commands: active=${Number(status.activeCommands || 0)} stale=${Number(status.staleCommands || 0)} invalid=${Number(status.invalidCommands || 0)} temporary=${Number(status.temporaryFiles || 0)}`,
    `Message: ${status.message || ''}`,
    '',
    'Channels:',
  ];
  const channels = Array.isArray(status.channels) ? status.channels : [];
  if (channels.length === 0) {
    lines.push('  (none found)');
  } else {
    channels.forEach((item) => lines.push(
      `  ${item.name}: diagnostics=${Boolean(item.diagnosticsExists)} active=${Number(item.activeCommands || 0)} stale=${Number(item.staleCommands || 0)} invalid=${Number(item.invalidCommands || 0)} temporary=${Number(item.temporaryFiles || 0)}`,
    ));
  }
  diagnosticsElement.value = lines.join('\n');
  diagnosticsElement.scrollTop = 0;
  diagnosticsPathElement.textContent = status.path || '';
  diagnosticsPanel.hidden = false;
  closeDiagnosticsButton.focus({ preventScroll: true });
}

// Removes only stale sync command files, then refreshes the visible health view.
async function cleanSyncFolder() {
  const result = await window.fpasoterm.syncClean();
  showDiagnostic(`sync clean ${result.message}`);
  await showSyncStatus();
}

// Formats one log item for the selector dropdown.
function terminalLogOptionLabel(item) {
  const size = Number(item.bytes || 0);
  const kib = Math.max(1, Math.ceil(size / 1024));
  return `${item.active ? '[active] ' : ''}${item.name || item.path} (${kib} KiB)`;
}

// Reloads the selector dropdown and keeps the previous selection when possible.
async function refreshTerminalLogList(selectedPath = '') {
  const items = await window.fpasoterm.listTerminalLogs();
  const previous = selectedPath || terminalLogSelectElement?.value || '';
  terminalLogSelectElement.replaceChildren();
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.path;
    option.textContent = terminalLogOptionLabel(item);
    terminalLogSelectElement.appendChild(option);
  }
  if (items.some((item) => item.path === previous)) {
    terminalLogSelectElement.value = previous;
  }
  return items;
}

// Renders a terminal log preview into the diagnostics panel.
function renderTerminalLogPreview(preview) {
  diagnosticsPanelMode = 'terminal-log';
  setTerminalLogPickerVisible(true);
  showDiagnosticsTextArea();
  if (diagnosticsTitleElement) {
    diagnosticsTitleElement.textContent = 'Terminal Log';
  }
  const lines = [];
  if (preview.message) {
    lines.push(preview.message);
  }
  if (preview.path) {
    lines.push(`path: ${preview.path}`);
  }
  if (preview.bytes === 0) {
    lines.push(`No terminal output has been captured yet. Use Log Start/Stop or ${keybindingLabel('logToggle')}, run commands, then use Log Show or ${keybindingLabel('logShow')}.`);
  }
  if (preview.truncated) {
    lines.push('The log is truncated in this view; showing the latest part only.');
  }
  if (preview.text) {
    lines.push('', preview.text);
  }
  diagnosticsPanel.hidden = false;
  diagnosticsElement.value = lines.join('\n') || 'No terminal output log found.';
  diagnosticsElement.scrollTop = 0;
  diagnosticsPathElement.textContent = preview.path || '';
  terminalLogSearchState = { query: '', text: '', matches: [], cursor: -1 };
  if (terminalLogSearchStatusElement) {
    terminalLogSearchStatusElement.textContent = '';
  }
  focusTerminalLogPanel();
}

// Displays the active or most recent terminal output log in the diagnostics panel.
async function showTerminalOutputLog(path = '') {
  await refreshTerminalLogList(path);
  const selectedPath = path || terminalLogSelectElement?.value || '';
  const preview = await window.fpasoterm.showTerminalLog(selectedPath);
  if (preview.path && terminalLogSelectElement) {
    terminalLogSelectElement.value = preview.path;
  }
  renderTerminalLogPreview(preview);
  const message = `terminal log shown path=${preview.path || '(none)'} bytes=${preview.bytes || 0} truncated=${preview.truncated ? 'true' : 'false'}`;
  console.error(message);
  window.fpasoterm?.logDiagnostic?.(message).catch(() => {});
}

// Clears all terminal output logs after explicit confirmation.
async function clearTerminalOutputLog() {
  const confirmed = await confirmTerminalLogAction(
    'Clear all terminal output logs?\n\nThis will empty the active log file and delete all stopped terminal-*.log files in the configured log directory. This cannot be undone.',
    terminalLogDeleteAllButton,
  );
  if (!confirmed) {
    showDiagnostic('terminal log clear canceled');
    restoreLogPanelFocus(terminalLogDeleteAllButton, { repeat: true });
    return null;
  }

  const status = await window.fpasoterm.clearTerminalLog();
  diagnosticsPanelMode = 'terminal-log';
  showDiagnosticsTextArea();
  if (diagnosticsTitleElement) {
    diagnosticsTitleElement.textContent = 'Terminal Log';
  }
  diagnosticsPanel.hidden = false;
  diagnosticsElement.value = `${status.message}\npath: ${status.path || '(none)'}\nbytes: ${status.bytesWritten || 0}`;
  diagnosticsPathElement.textContent = status.path || '';
  await refreshTerminalLogList(status.path || '');
  await refreshTerminalLogControl();
  showDiagnostic(`terminal log cleared path=${status.path || '(none)'} bytes=${status.bytesWritten || 0}`);
  restoreLogPanelFocus(terminalLogDeleteAllButton, { repeat: true });
  return status;
}

// Deletes the currently selected stopped log after confirmation.
async function deleteSelectedTerminalOutputLog() {
  const path = terminalLogSelectElement?.value || '';
  if (!path) {
    showDiagnostic('terminal log delete skipped: no log selected');
    return null;
  }
  const confirmed = await confirmTerminalLogAction(
    `Delete the selected terminal output log?\n\n${path}\n\nThis cannot be undone.`,
    terminalLogDeleteSelectedButton,
  );
  if (!confirmed) {
    showDiagnostic('terminal log delete canceled');
    restoreLogPanelFocus(terminalLogDeleteSelectedButton, { repeat: true });
    return null;
  }
  const status = await window.fpasoterm.deleteTerminalLog(path);
  await refreshTerminalLogList();
  showDiagnosticsTextArea();
  diagnosticsElement.value = `${status.message}\npath: ${status.path || '(none)'}`;
  diagnosticsPathElement.textContent = status.path || '';
  showDiagnostic(`terminal log deleted path=${status.path || '(none)'}`);
  restoreLogPanelFocus(terminalLogSelectElement?.options?.length > 0 ? terminalLogSelectElement : closeDiagnosticsButton, {
    repeat: true,
  });
  return status;
}

// Hides the diagnostics/log panel when it blocks the terminal view.
closeDiagnosticsButton.addEventListener('click', () => {
  diagnosticsPanel.hidden = true;
  focusTerminalInput();
});

terminalLogToggleButton.addEventListener('click', () => {
  toggleTerminalOutputLog();
});

terminalLogShowButton.addEventListener('click', () => {
  showTerminalOutputLogFromMenu();
});

syncStatusButton.addEventListener('click', () => {
  showSyncStatus().catch((error) => showDiagnostic(`sync status failed: ${error}`));
});

syncCleanButton.addEventListener('click', () => {
  cleanSyncFolder().catch((error) => showDiagnostic(`sync clean failed: ${error}`));
});

fontGlyphTestButton.addEventListener('click', () => {
  showFontGlyphTest();
});

terminalCapabilityTestButton.addEventListener('click', () => {
  showTerminalCapabilityTest().catch((error) => showDiagnostic(`terminal capability diagnostics failed: ${error}`));
});

logMenuToggleButton.addEventListener('click', () => {
  setWindowMenuSubmenuOpen('log', logMenuItems.hidden);
});

syncMenuToggleButton.addEventListener('click', () => {
  setWindowMenuSubmenuOpen('sync', syncMenuItems.hidden);
});

diagnosticsMenuToggleButton.addEventListener('click', () => {
  setWindowMenuSubmenuOpen('diagnostics', diagnosticsMenuItems.hidden);
});

pluginMenuToggleButton.addEventListener('click', () => {
  setWindowMenuSubmenuOpen('plugins', pluginCommandItems.hidden);
});

windowActionsMenuToggleButton.addEventListener('click', () => {
  setWindowMenuSubmenuOpen('window', windowActionsMenuItems.hidden);
});

terminalLogShowSelectedButton.addEventListener('click', () => {
  showTerminalOutputLog(terminalLogSelectElement?.value || '').catch((error) => {
    showDiagnostic(`terminal log selected show failed: ${error}`);
  });
});

terminalLogSearchNextButton.addEventListener('click', () => {
  searchTerminalLogText();
});

terminalLogSearchElement.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') {
    return;
  }
  event.preventDefault();
  searchTerminalLogText();
});

terminalLogSearchElement.addEventListener('input', () => {
  terminalLogSearchState = { query: '', text: '', matches: [], cursor: -1 };
  if (terminalLogSearchStatusElement) {
    terminalLogSearchStatusElement.textContent = '';
  }
});

terminalLogDeleteSelectedButton.addEventListener('click', () => {
  deleteSelectedTerminalOutputLog().catch((error) => {
    showDiagnostic(`terminal log selected delete failed: ${error}`);
  });
});

terminalLogDeleteAllButton.addEventListener('click', () => {
  clearTerminalOutputLog().catch((error) => {
    showDiagnostic(`terminal log delete all failed: ${error}`);
    restoreLogPanelFocus(terminalLogDeleteAllButton, { repeat: true });
  });
});

terminalLogConfirmOkButton.addEventListener('click', () => {
  resolveTerminalLogConfirm(true);
});

terminalLogConfirmCancelButton.addEventListener('click', () => {
  resolveTerminalLogConfirm(false);
});

closeAllConfirmOkButton.addEventListener('click', () => {
  resolveCloseAllWindows(true);
});

closeAllConfirmCancelButton.addEventListener('click', () => {
  resolveCloseAllWindows(false);
});

closeAllConfirmElement.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    resolveCloseAllWindows(false);
  }
});

terminalCopyButton.addEventListener('click', () => {
  copyTerminalSelection().catch((error) => {
    showDiagnostic(`terminal menu copy failed: ${error}`);
  }).finally(() => setWindowMenuOpen(false));
});

terminalPasteButton.addEventListener('click', () => {
  pasteClipboardToTerminal().catch((error) => {
    showDiagnostic(`terminal menu paste failed: ${error}`);
  }).finally(() => setWindowMenuOpen(false));
});

// Kills the active terminal command while preserving the interactive shell.
terminalKillButton.addEventListener('click', () => {
  window.fpasoterm.killTerminal().then(() => {
    showDiagnostic('terminal kill requested');
  }).catch((error) => {
    showDiagnostic(`terminal kill failed: ${error}`);
  }).finally(() => setWindowMenuOpen(false));
});

terminalBroadcastButton.addEventListener('click', () => {
  openTerminalBroadcastDialog().catch((error) => showDiagnostic(`terminal broadcast dialog failed: ${error}`));
});

terminalBroadcastSelectAllButton.addEventListener('click', () => {
  terminalBroadcastTargetList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = true;
  });
  refreshTerminalBroadcastSyncOption();
});

terminalBroadcastControlInsertButton.addEventListener('click', () => {
  insertTerminalBroadcastControl();
});

terminalBroadcastSelectNoneButton.addEventListener('click', () => {
  terminalBroadcastTargetList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
  });
  refreshTerminalBroadcastSyncOption();
});

terminalBroadcastSendButton.addEventListener('click', () => {
  sendTerminalBroadcast().catch((error) => {
    showDiagnostic(`terminal broadcast failed: ${error}`);
    terminalBroadcastText?.focus({ preventScroll: true });
  });
});

terminalBroadcastCancelButton.addEventListener('click', () => {
  closeTerminalBroadcastDialog();
});

terminalBroadcastConfirmOkButton.addEventListener('click', () => {
  resolveDangerousBroadcastConfirmation(true);
});

terminalBroadcastConfirmCancelButton.addEventListener('click', () => {
  resolveDangerousBroadcastConfirmation(false);
});

terminalBroadcastConfirmElement.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    resolveDangerousBroadcastConfirmation(false);
  }
});

terminalBroadcastDialog.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeTerminalBroadcastDialog();
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    sendTerminalBroadcast().catch((error) => showDiagnostic(`terminal broadcast failed: ${error}`));
  }
});

document.addEventListener('keydown', (event) => {
  if (matchesKeybinding(event, 'logMenu')) {
    event.preventDefault();
    const open = windowMenuItems?.hidden !== false;
    setWindowMenuOpen(open);
    if (open) {
      setWindowMenuSubmenuOpen('log', true, terminalLogToggleButton);
    }
    return;
  }

  if (matchesKeybinding(event, 'menu')) {
    event.preventDefault();
    setWindowMenuOpen(windowMenuItems?.hidden !== false);
    return;
  }

  if (matchesKeybinding(event, 'help')) {
    event.preventDefault();
    showKeyboardShortcutsHelp().catch((error) => showDiagnostic(`help failed: ${error}`));
    return;
  }

  if (matchesKeybinding(event, 'logToggle')) {
    event.preventDefault();
    toggleTerminalOutputLog();
    return;
  }

  if (matchesKeybinding(event, 'logShow')) {
    event.preventDefault();
    showTerminalOutputLogFromMenu();
  }
}, true);

diagnosticsPanel.addEventListener('keydown', (event) => {
  if (diagnosticsPanel.hidden) {
    return;
  }

  if (terminalLogConfirmElement && !terminalLogConfirmElement.hidden) {
    if (event.key === 'Escape') {
      event.preventDefault();
      resolveTerminalLogConfirm(false);
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      focusDiagnosticsPanelItem(event.shiftKey ? -1 : 1);
    }
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    diagnosticsPanel.hidden = true;
    focusTerminalInput();
    return;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    focusDiagnosticsPanelItem(event.shiftKey ? -1 : 1);
    return;
  }

  const isSearchInput = event.target === terminalLogSearchElement;
  const isLogSelector = event.target === terminalLogSelectElement;
  if (!isSearchInput && !isLogSelector && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    searchTerminalLogText(1);
    return;
  }

  if (!isSearchInput && !isLogSelector && event.key.toLowerCase() === 'p') {
    event.preventDefault();
    searchTerminalLogText(-1);
    return;
  }

  if (event.target === diagnosticsElement) {
    if (event.key.toLowerCase() === 'j') {
      event.preventDefault();
      searchTerminalLogText(1);
      return;
    }

    if (event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchTerminalLogText(-1);
    }
    return;
  }

  if (
    event.target === terminalLogSelectElement ||
    event.target === terminalLogSearchElement
  ) {
    return;
  }

  if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    focusDiagnosticsPanelItem(1);
    return;
  }

  if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    focusDiagnosticsPanelItem(-1);
  }
});

document.addEventListener('pointerdown', (event) => {
  if (windowMenu && !windowMenuItems.hidden && !windowMenu.contains(event.target)) {
    setWindowMenuOpen(false);
  }
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

// Starts another fpasoterm process for a separate terminal window.
newWindowButton.addEventListener('click', () => {
  setWindowMenuOpen(false);
  window.fpasoterm.newWindow?.().catch((error) => showDiagnostic(`new window failed: ${error}`));
});

// Requests a grid layout for all currently running fpasoterm windows.
arrangeWindowButton.addEventListener('click', () => {
  setWindowMenuOpen(false);
  window.fpasoterm.arrangeWindows?.(getAvailableScreenBounds())
    .then((message) => showDiagnostic(message))
    .catch((error) => showDiagnostic(`window arrange failed: ${error}`));
});

// Broadcasts a close request to every running fpasoterm process.
closeAllWindowsButton.addEventListener('click', () => {
  setWindowMenuOpen(false);
  requestCloseAllWindows();
});

// Opens the keyboard shortcut reference from the window menu.
keyboardShortcutsHelpButton.addEventListener('click', () => {
  showKeyboardShortcutsHelp().catch((error) => showDiagnostic(`help failed: ${error}`));
});

// Queries npm only after an explicit Help-panel action, preserving offline startup behavior.
checkForUpdatesButton?.addEventListener('click', async () => {
  checkForUpdatesButton.disabled = true;
  checkForUpdatesButton.textContent = 'Checking...';
  try {
    const status = await window.fpasoterm.checkForUpdate();
    const result = status.updateAvailable
      ? 'Status: update available. Run: fpasoterm --self-update'
      : status.localBuildNewer
        ? 'Status: local build is newer than npm latest.'
        : 'Status: up to date.';
    diagnosticsElement.value = [
      diagnosticsElement.value,
      '',
      `Installed: ${status.installed}`,
      `Latest npm release: ${status.latest}`,
      result,
    ].join('\n');
    diagnosticsElement.scrollTop = diagnosticsElement.scrollHeight;
    checkForUpdatesButton.textContent = status.updateAvailable ? 'Update Available' : 'Up to Date';
  } catch (error) {
    diagnosticsElement.value = `${diagnosticsElement.value}\n\nUpdate check failed: ${error}`;
    diagnosticsElement.scrollTop = diagnosticsElement.scrollHeight;
    checkForUpdatesButton.textContent = 'Check Failed';
    showDiagnostic(`update check failed: ${error}`);
  } finally {
    checkForUpdatesButton.disabled = false;
  }
});

// Reports the logical work area so ChromeOS shelf and display scaling are not
// mistaken for usable native monitor pixels during window tiling.
function getAvailableScreenBounds() {
  const screen = window.screen;
  return {
    width: screen.availWidth,
    height: screen.availHeight,
    left: screen.availLeft || 0,
    top: screen.availTop || 0,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

// Opens or closes the compact window action menu.
function setWindowMenuOpen(open, preferredItem = newWindowButton) {
  if (!windowMenuItems || !windowMenuToggleButton) {
    return;
  }
  windowMenuItems.hidden = !open;
  windowMenuToggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (!open) {
    closeWindowMenuSubmenus();
  }
  if (open) {
    closeWindowMenuSubmenus();
    fitWindowMenuToViewport();
    const focusTarget = preferredItem && !preferredItem.hidden && !preferredItem.disabled
      ? preferredItem
      : newWindowButton;
    focusTarget.focus();
  }
}

windowMenuToggleButton.addEventListener('click', () => {
  setWindowMenuOpen(windowMenuItems.hidden);
});

windowMenuToggleButton.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    setWindowMenuOpen(true);
  }
});

windowMenuItems.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    setWindowMenuOpen(false);
    windowMenuToggleButton.focus({ preventScroll: true });
    return;
  }
  if (event.key === 'Tab' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const backwards = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey);
    focusWindowMenuItem(backwards ? -1 : 1);
    return;
  }

  const submenu = windowMenuSubmenuForElement(document.activeElement);
  if (event.key === 'ArrowRight' && document.activeElement?.classList.contains('window-menu-submenu-toggle')) {
    event.preventDefault();
    const firstChild = submenu?.items.querySelector('button:not([hidden]):not(:disabled)');
    setWindowMenuSubmenuOpen(submenu?.name, true, firstChild);
    return;
  }

  if (event.key === 'ArrowLeft' && submenu && document.activeElement !== submenu.toggle) {
    event.preventDefault();
    setWindowMenuSubmenuOpen(submenu.name, false);
    submenu.toggle.focus({ preventScroll: true });
  }
});

window.addEventListener('resize', fitWindowMenuToViewport);

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
  pluginVersion = await window.fpasoterm.getAppVersion?.().catch(() => 'unknown') || 'unknown';
  await installSyncControls();
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
    sendTerminalInput(data, 'input');
  });

  Promise.resolve(window.fpasoterm.onTerminalData((data) => {
    queueTerminalOutput(data);
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
    scheduleSyncDiagnosticsWrite();
  })).catch((error) => {
    showDiagnostic(`diagnostic listener failed: ${error}`);
  });

  for (const eventName of ['keydown', 'keyup', 'compositionstart', 'compositionupdate', 'compositionend']) {
    window.addEventListener(eventName, (event) => {
      const message =
        eventName.startsWith('composition')
          ? `renderer ${eventName} data=${event.data}`
          : `renderer ${eventName} key=${event.key} code=${event.code} ctrl=${event.ctrlKey} alt=${event.altKey} shift=${event.shiftKey} meta=${event.metaKey} composing=${event.isComposing}`;
      showDiagnostic(message);
    });
  }

  window.addEventListener('focus', focusTerminalInput);
  terminalElement.addEventListener('pointerdown', () => {
    setTimeout(focusTerminalInput, 0);
  });

  await loadPlugins();
  installTerminalPasteHandlers();
  await afterNextPaint();
  fitAddon.fit();
  try {
    await window.fpasoterm.startTerminal(terminalPtySize());
    await refreshTerminalLogControl();
    await afterNextPaint();
    fitAndResize();
  } catch (error) {
    showTerminalError(`failed to start terminal backend: ${error.stack || error.message || error}`);
    return;
  }
  installCompositionDuplicateGuard();
  // A no-output fallback keeps lifecycle plugins usable for shells that do not
  // print a prompt. Normal PTY output resets this timer until it is painted.
  schedulePluginsReadyAfterTerminalOutput(350);
  focusTerminalInput();
}

initialize();
