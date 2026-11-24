const assert = require('node:assert/strict');
const { createImeCommitRouter } = require('../../src/renderer/ime-commit-router.js');

let clock = 0;
const router = createImeCommitRouter({ now: () => clock, duplicateWindowMs: 800 });

// Marked candidate text and IME key events never reach the terminal.
assert.equal(router.compositionStart().suppress, true);
assert.equal(router.captureKey({ keyCode: 229 }), true);
assert.equal(router.captureKey({ key: 'ArrowDown', isComposing: true }), true);
assert.deepEqual(
  router.compositionInput({ inputType: 'insertCompositionText', isComposing: true, data: 'へんかん' }),
  { suppress: true, action: 'hold-composition-input', commit: '' },
);

// One populated compositionend is the only terminal write.
assert.deepEqual(
  router.compositionEnd('変換後の文字'),
  { suppress: true, action: 'commit-composition-end', commit: '変換後の文字' },
);
clock += 10;
assert.deepEqual(
  router.compositionInput({ inputType: 'insertFromComposition', data: '変換後の文字' }),
  { suppress: true, action: 'drop-duplicate-commit', commit: '' },
);
assert.deepEqual(
  router.compositionInput({ inputType: 'insertText', data: '変換後の文字' }),
  { suppress: true, action: 'drop-follow-up-composition-input', commit: '' },
);

// An empty preliminary end waits for the final input representation.
clock += 10;
router.compositionStart();
assert.deepEqual(
  router.compositionEnd(''),
  { suppress: true, action: 'hold-empty-composition-end', commit: '' },
);
clock += 10;
assert.deepEqual(
  router.compositionInput({ inputType: 'insertFromComposition', data: '確定' }),
  { suppress: true, action: 'commit-composition-input', commit: '確定' },
);

// A duplicated complete composition cycle is still emitted only once, while
// unrelated plain typing remains untouched.
clock += 10;
router.compositionStart();
assert.deepEqual(
  router.compositionEnd('確定'),
  { suppress: true, action: 'drop-duplicate-commit', commit: '' },
);
assert.deepEqual(router.compositionInput({ inputType: 'insertText', data: 'a' }), {
  suppress: false,
  action: 'pass',
  commit: '',
});

// Cancelling a conversion does not absorb the next ordinary input.
clock += 900;
router.compositionStart();
router.compositionEnd('');
assert.deepEqual(router.compositionInput({ inputType: 'insertText', data: 'b' }), {
  suppress: false,
  action: 'pass',
  commit: '',
});

process.stdout.write('IME commit router tests passed\n');
