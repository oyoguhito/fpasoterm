const terminalElement = document.getElementById('terminal');
const diagnosticsPanel = document.getElementById('diagnostics-panel');
const diagnosticsElement = document.getElementById('diagnostics');
const diagnosticsPathElement = document.getElementById('diagnostics-path');
const copyDiagnosticsButton = document.getElementById('copy-diagnostics');
const debugKeys = new URLSearchParams(window.location.search).has('debugKeys');
const diagnosticLines = [];

window.addEventListener('error', (event) => {
  console.error(`renderer error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error(`renderer unhandled rejection: ${event.reason}`);
});

const term = new Terminal({
  cursorBlink: true,
  cursorStyle: 'block',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Noto Sans Mono CJK JP", monospace',
  fontSize: 14,
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
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(terminalElement);

function fitAndResize() {
  fitAddon.fit();
  window.fpasoterm.resizeTerminal({ cols: term.cols, rows: term.rows });
}

function focusTerminalInput() {
  term.focus();

  const textarea = terminalElement.querySelector('.xterm-helper-textarea');
  if (textarea) {
    textarea.focus({ preventScroll: true });
  }
}

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

if (debugKeys) {
  window.fpasoterm.getDiagnosticsPath().then((logPath) => {
    diagnosticsPathElement.textContent = logPath;
  });
}

copyDiagnosticsButton.addEventListener('click', async () => {
  const copiedLength = await window.fpasoterm.copyDiagnostics();
  copyDiagnosticsButton.textContent = copiedLength > 0 ? 'Copied' : 'No Logs';
  setTimeout(() => {
    copyDiagnosticsButton.textContent = 'Copy';
  }, 1200);
});

window.addEventListener('resize', fitAndResize);

term.onData((data) => {
  window.fpasoterm.writeTerminal(data);
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

fitAddon.fit();
window.fpasoterm.startTerminal({ cols: term.cols, rows: term.rows });
focusTerminalInput();
