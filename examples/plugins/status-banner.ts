/// <reference path="../../docs/fpasoterm-plugin.d.ts" />

// Registers a menu action that shows resolved settings after startup.
const api = window.fpasotermPluginApi;
const { width, height } = api.config.window;
const enabledCount = api.config.plugins.enabled.length;

api.log(`status-banner.ts loaded for ${width}x${height}, plugins=${enabledCount}`);
api.registerCommand('status-banner.show', 'Show Plugin Status', () => {
  api.terminal.writeln(`[fpasoterm] Status: ${width}x${height}, enabled plugins: ${enabledCount}.`);
  api.terminal.focus();
});
