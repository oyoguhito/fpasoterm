/// <reference path="../../docs/fpasoterm-plugin.d.ts" />
// @fpasoterm-plugin version: 1.0.0
// @fpasoterm-plugin description: Applies the visible teal sample terminal palette.

// This sample applies a visibly different terminal palette after startup.
// Use config.toml for normal settings; use plugins for temporary behavior changes.
const api = window.fpasotermPluginApi;

api.log('theme.ts loaded: applying the teal sample palette');
api.terminal.options.theme = {
  ...api.config.terminal.theme,
  background: 'rgba(8, 42, 48, 0.86)',
  foreground: '#d8f6f3',
  cursor: '#ffdc73',
  selectionBackground: '#246b73',
  blue: '#75c9ff',
  cyan: '#73e6dd',
  green: '#a9df7d',
};
api.fitAddon.fit();
api.onReady(() => {
  api.terminal.writeln('[fpasoterm plugin] theme.ts applied the teal sample palette.');
});
