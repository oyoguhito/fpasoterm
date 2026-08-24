/// <reference path="../../docs/fpasoterm-plugin.d.ts" />
// @fpasoterm-plugin version: 1.0.0
// @fpasoterm-plugin description: Writes a confirmation after the terminal is ready.

// This sample demonstrates the minimum plugin shape.
// Wait for the PTY before writing, so shell initialization cannot erase it.
const api = window.fpasotermPluginApi;

api.log('hello.ts loaded');
api.registerCommand('hello.show', 'Show Hello Banner', () => {
  api.terminal.writeln('[fpasoterm plugin] hello.ts loaded');
  api.terminal.focus();
});
api.onReady(() => {
  api.terminal.writeln('');
  api.terminal.writeln('[fpasoterm plugin] hello.ts loaded');
});
