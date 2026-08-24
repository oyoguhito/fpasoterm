/// <reference path="../../docs/fpasoterm-plugin.d.ts" />
// @fpasoterm-plugin version: 1.0.0
// @fpasoterm-plugin description: Displays a local welcome banner after startup.

// Shows a small, local-only startup message after the PTY is ready.
const api = window.fpasotermPluginApi;

api.log('welcome-banner.ts loaded');
api.registerCommand('welcome-banner.show', 'Show Welcome Banner', () => {
  api.terminal.writeln(`[fpasoterm ${api.version}] Welcome banner plugin is active.`);
  api.terminal.focus();
});
api.onReady(() => {
  api.terminal.writeln('');
  api.terminal.writeln(`[fpasoterm ${api.version}] Welcome banner plugin is active.`);
});
