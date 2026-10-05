(function exposePluginTerminalInput(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.fpasotermPluginTerminalInput = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';

  function normalizePluginTerminalText(text) {
    const value = String(text ?? '');
    if (!value) throw new Error('insertTerminalText requires non-empty text');
    if (value.length > 4096) throw new Error('insertTerminalText is limited to 4096 characters');
    if (/[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
      throw new Error('insertTerminalText does not accept control characters');
    }
    return value;
  }

  // Reviewed plugins may request only these named control inputs. Arbitrary
  // escape sequences and Enter remain unavailable to plugins.
  function pluginTerminalShortcutSequence(shortcut) {
    const sequences = {
      'terminal-browser-zoom-out': '\x1b-',
      'terminal-browser-zoom-in': '\x1b=',
      'terminal-browser-zoom-reset': '\x1b0',
      'terminal-browser-zoom-50': '\x1b-\x1b-\x1b-\x1b-\x1b-',
    };
    const sequence = sequences[String(shortcut || '')];
    if (!sequence) throw new Error(`unsupported terminal shortcut: ${shortcut}`);
    return sequence;
  }

  return Object.freeze({ normalizePluginTerminalText, pluginTerminalShortcutSequence });
}));
