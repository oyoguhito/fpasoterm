const assert = require('node:assert/strict');
const { createImeInputGuard } = require('../../src/renderer/ime-input-guard.js');

let clock = 0;
const guard = createImeInputGuard({ now: () => clock, windowMs: 400 });

// The first xterm commit is always preserved.
guard.compositionStart();
guard.compositionEnd('日本語入力');
assert.deepEqual(guard.filterTerminalInput('日本語入力'), { data: '日本語入力', action: 'pass' });

// A second full commit and the Windows-only final-glyph replay are removed.
clock += 12;
assert.deepEqual(guard.filterTerminalInput('日本語入力'), { data: '', action: 'drop-duplicated-commit' });

// WebView2 can report the replay as a second composition cycle. Keep the
// fresh original commit until its duplicate reaches xterm onData.
guard.compositionStart();
guard.compositionEnd('再入力');
assert.deepEqual(guard.filterTerminalInput('再入力'), { data: '再入力', action: 'pass' });
clock += 12;
guard.compositionStart();
guard.compositionEnd('再入力');
assert.deepEqual(guard.filterTerminalInput('再入力'), { data: '', action: 'drop-duplicated-commit' });

guard.compositionStart();
guard.compositionEnd('変換後の文字');
assert.deepEqual(guard.filterTerminalInput('変換後の文字'), { data: '変換後の文字', action: 'pass' });
clock += 12;
assert.deepEqual(guard.filterTerminalInput('文字'), { data: '', action: 'drop-duplicated-commit-suffix' });

// A concatenated commit is reduced to one copy, but control input, normal
// typing, and a single following glyph are never filtered.
guard.compositionStart();
guard.compositionEnd('確定');
assert.deepEqual(guard.filterTerminalInput('確定確定'), { data: '確定', action: 'collapse-duplicated-commit' });
guard.compositionStart();
guard.compositionEnd('かな');
assert.deepEqual(guard.filterTerminalInput('かな'), { data: 'かな', action: 'pass' });
clock += 12;
assert.deepEqual(guard.filterTerminalInput('a'), { data: 'a', action: 'pass' });
guard.compositionStart();
guard.compositionEnd('かな');
assert.deepEqual(guard.filterTerminalInput('\x1b[A'), { data: '\x1b[A', action: 'pass' });

// It expires promptly rather than comparing future ordinary typing.
guard.compositionStart();
guard.compositionEnd('同じ');
assert.deepEqual(guard.filterTerminalInput('同じ'), { data: '同じ', action: 'pass' });
clock += 401;
assert.deepEqual(guard.filterTerminalInput('同じ'), { data: '同じ', action: 'pass' });

process.stdout.write('IME input guard tests passed\n');
