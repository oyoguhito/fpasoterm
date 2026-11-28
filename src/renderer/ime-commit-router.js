(function exposeImeCommitRouter(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.fpasotermImeCommitRouter = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';

  const DEFAULT_DUPLICATE_WINDOW_MS = 800;
  const FOLLOW_UP_INPUT_WINDOW_MS = 160;
  const EMPTY_END_WINDOW_MS = 350;

  function isPlainText(value) {
    return typeof value === 'string' && value.length > 0
      && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
  }

  function windowMs(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 80 && parsed <= 1_000 ? parsed : fallback;
  }

  // WebKitGTK can deliver composition commits to xterm more than once: as a
  // populated compositionend, a later input event, or even a second
  // composition cycle. This router provides one owner for that delivery. It
  // never treats marked/candidate text as terminal input; only a final commit
  // from compositionend or insertFromComposition is returned to the caller.
  function createImeCommitRouter(options = {}) {
    const now = typeof options.now === 'function' ? options.now : () => performance.now();
    const duplicateWindowMs = windowMs(options.duplicateWindowMs, DEFAULT_DUPLICATE_WINDOW_MS);
    let composing = false;
    let emptyEndUntil = 0;
    let lastCommit = null;

    function clearExpired() {
      const current = now();
      if (emptyEndUntil && current > emptyEndUntil) emptyEndUntil = 0;
      if (lastCommit && current - lastCommit.time > duplicateWindowMs) lastCommit = null;
    }

    function suppress(action, commit = '') {
      return { suppress: true, action, commit };
    }

    function pass() {
      return { suppress: false, action: 'pass', commit: '' };
    }

    function commit(value, action) {
      clearExpired();
      const text = String(value || '');
      if (!isPlainText(text)) return suppress('ignore-empty-commit');
      composing = false;
      emptyEndUntil = 0;
      if (lastCommit && text === lastCommit.value && now() - lastCommit.time <= duplicateWindowMs) {
        return suppress('drop-duplicate-commit');
      }
      lastCommit = { value: text, time: now() };
      return suppress(action, text);
    }

    function compositionStart() {
      clearExpired();
      composing = true;
      emptyEndUntil = 0;
      return suppress('hold-composition-start');
    }

    function compositionUpdate() {
      return suppress('hold-composition-update');
    }

    function compositionEnd(value) {
      const text = String(value || '');
      if (isPlainText(text)) return commit(text, 'commit-composition-end');
      composing = false;
      // Some WebKitGTK IMEs emit an empty end immediately before the populated
      // end. Keep only the finalization channel alive briefly; a cancel emits
      // no commit and ordinary subsequent input remains native.
      emptyEndUntil = now() + EMPTY_END_WINDOW_MS;
      return suppress('hold-empty-composition-end');
    }

    function captureKey(event = {}) {
      clearExpired();
      return composing || Boolean(event.isComposing)
        || Number(event.keyCode) === 229 || event.key === 'Process';
    }

    function compositionInput(event = {}) {
      clearExpired();
      const inputType = String(event.inputType || '');
      const text = String(event.data || '');
      const compositionInput = Boolean(event.isComposing)
        || inputType === 'insertCompositionText'
        || inputType === 'deleteCompositionText';
      if (compositionInput) return suppress('hold-composition-input');

      if (inputType === 'insertFromComposition') {
        return commit(text, 'commit-composition-input');
      }

      // compositionend may precede a regular insertText input event. xterm
      // must not receive that second representation of the direct commit.
      if (lastCommit && text === lastCommit.value
          && now() - lastCommit.time <= FOLLOW_UP_INPUT_WINDOW_MS) {
        return suppress('drop-follow-up-composition-input');
      }
      return pass();
    }

    function clear() {
      composing = false;
      emptyEndUntil = 0;
      lastCommit = null;
    }

    return Object.freeze({
      compositionStart,
      compositionUpdate,
      compositionEnd,
      captureKey,
      compositionInput,
      clear,
    });
  }

  return Object.freeze({ createImeCommitRouter });
}));
