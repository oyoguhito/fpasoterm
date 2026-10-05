const assert = require('node:assert/strict');
const { normalizePluginTerminalText, pluginTerminalShortcutSequence } = require('../../src/renderer/plugin-terminal-input.js');

assert.equal(normalizePluginTerminalText('terminal-browser open https://example.com'), 'terminal-browser open https://example.com');
assert.equal(normalizePluginTerminalText('日本語 https://例.example'), '日本語 https://例.example');
assert.throws(() => normalizePluginTerminalText(''), /non-empty/);
assert.throws(() => normalizePluginTerminalText('echo ok\n'), /control characters/);
assert.throws(() => normalizePluginTerminalText('echo ok\r'), /control characters/);
assert.throws(() => normalizePluginTerminalText('\u001b[31m'), /control characters/);
assert.throws(() => normalizePluginTerminalText('x'.repeat(4097)), /4096/);
assert.equal(pluginTerminalShortcutSequence('terminal-browser-zoom-out'), '\x1b-');
assert.equal(pluginTerminalShortcutSequence('terminal-browser-zoom-in'), '\x1b=');
assert.equal(pluginTerminalShortcutSequence('terminal-browser-zoom-reset'), '\x1b0');
assert.equal(pluginTerminalShortcutSequence('terminal-browser-zoom-50'), '\x1b-'.repeat(5));
assert.throws(() => pluginTerminalShortcutSequence('arbitrary'), /unsupported terminal shortcut/);

process.stdout.write('plugin terminal input tests passed\n');
