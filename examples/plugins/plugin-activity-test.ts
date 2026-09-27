/// <reference path="../../docs/fpasoterm-plugin.d.ts" />
// @fpasoterm-plugin version: 1.0.0
// @fpasoterm-plugin description: Exercises normal and failed Plugin activity UI states.

// This intentionally local-only example gives contributors repeatable UI checks
// without relying on a network or a real port plugin.
const api = window.fpasotermPluginApi;

api.registerCommand('plugin-activity-test.success', 'Test Plugin Activity Success', () => {
  api.terminal.writeln('[fpasoterm] Plugin activity success test completed.');
  api.terminal.focus();
});

api.registerCommand('plugin-activity-test.error', 'Test Plugin Activity Error', () => {
  throw new Error('Intentional Plugin activity test error');
});
