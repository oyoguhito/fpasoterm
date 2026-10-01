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

  return Object.freeze({ normalizePluginTerminalText });
}));
