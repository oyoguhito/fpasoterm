(function exposeImeInputGuard(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.fpasotermImeInputGuard = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';

  const DEFAULT_WINDOW_MS = 400;
  const MINIMUM_SUFFIX_CODEPOINTS = 2;

  function isPlainText(data) {
    return typeof data === 'string' && data.length > 0 && !/[\u0000-\u001f\u007f-\u009f]/u.test(data);
  }

  function validWindowMs(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 100 && parsed <= 1000
      ? parsed
      : DEFAULT_WINDOW_MS;
  }

  // Keeps only the immediate browser/xterm composition commit. This is
  // deliberately narrower than a general text de-duplicator: ordinary typing,
  // paste, escape sequences, and a one-code-point follow-up are never changed.
  function createImeInputGuard(options = {}) {
    const now = typeof options.now === 'function' ? options.now : () => performance.now();
    const enabled = options.enabled !== false;
    const windowMs = validWindowMs(options.windowMs);
    let pendingCommit = null;

    function clear() {
      pendingCommit = null;
    }

    function compositionStart() {
      clear();
    }

    function compositionEnd(text) {
      const value = String(text || '');
      pendingCommit = isPlainText(value)
        ? { value, time: now(), delivered: false }
        : null;
    }

    function filterTerminalInput(data) {
      const value = String(data ?? '');
      if (!enabled || !isPlainText(value) || !pendingCommit) {
        return { data: value, action: 'pass' };
      }

      const elapsed = now() - pendingCommit.time;
      if (elapsed < 0 || elapsed > windowMs) {
        clear();
        return { data: value, action: 'pass' };
      }

      const committed = pendingCommit.value;
      // A few WebViews produce both copies in one xterm onData callback.
      if (!pendingCommit.delivered && value === committed + committed) {
        clear();
        return { data: committed, action: 'collapse-duplicated-commit' };
      }

      if (!pendingCommit.delivered && value === committed) {
        pendingCommit.delivered = true;
        return { data: value, action: 'pass' };
      }

      if (pendingCommit.delivered && value === committed) {
        clear();
        return { data: '', action: 'drop-duplicated-commit' };
      }

      // Windows IME can replay only the final converted two or three glyphs.
      // Do not consume a single glyph: it is too easy for that to be normal
      // deliberate typing after conversion.
      if (
        pendingCommit.delivered
        && committed.endsWith(value)
        && Array.from(value).length >= MINIMUM_SUFFIX_CODEPOINTS
      ) {
        clear();
        return { data: '', action: 'drop-duplicated-commit-suffix' };
      }

      // The next unrelated write is normal terminal input. It must not be
      // compared with a stale composition on a later keystroke.
      clear();
      return { data: value, action: 'pass' };
    }

    return Object.freeze({ compositionStart, compositionEnd, filterTerminalInput, clear });
  }

  return Object.freeze({ createImeInputGuard });
}));
