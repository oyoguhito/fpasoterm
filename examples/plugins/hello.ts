/// <reference path="../../docs/fpasoterm-plugin.d.ts" />

// This sample demonstrates the minimum plugin shape.
// It writes a short message to diagnostics and the terminal.
const api = window.fpasotermPluginApi;

api.log('hello.ts loaded');
api.terminal.writeln('');
api.terminal.writeln('[fpasoterm plugin] hello.ts loaded');
