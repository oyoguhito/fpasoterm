const { contextBridge, ipcRenderer } = require('electron');

// Exposes a small, explicit IPC API to the renderer without enabling Node.js there.
contextBridge.exposeInMainWorld('fpasoterm', {
  startTerminal: (size) => ipcRenderer.invoke('terminal:start', size),
  writeTerminal: (data) => ipcRenderer.send('terminal:write', data),
  resizeTerminal: (size) => ipcRenderer.send('terminal:resize', size),
  onTerminalData: (callback) => {
    ipcRenderer.on('terminal:data', (_event, data) => callback(data));
  },
  onTerminalExit: (callback) => {
    ipcRenderer.on('terminal:exit', (_event, exitCode) => callback(exitCode));
  },
  onDiagnosticEvent: (callback) => {
    ipcRenderer.on('diagnostics:event', (_event, event) => callback(event));
  },
  copyDiagnostics: () => ipcRenderer.invoke('diagnostics:copy'),
  getDiagnosticsPath: () => ipcRenderer.invoke('diagnostics:path'),
  getConfig: () => ipcRenderer.invoke('config:get'),
});
