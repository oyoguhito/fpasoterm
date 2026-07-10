/// <reference path="../../docs/fpasoterm-plugin.d.ts" />

// This sample changes a few terminal options after startup.
// Use config.toml for normal settings; use plugins for behavior changes.
const api = window.fpasotermPluginApi;

api.log('theme.ts loaded');
api.terminal.options.cursorBlink = true;
api.terminal.options.fontSize = 15;
api.fitAddon.fit();
