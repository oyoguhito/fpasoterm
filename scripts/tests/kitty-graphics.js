const assert = require('node:assert/strict');
const {
  DEFAULT_LIMITS,
  KittyGraphicsAddon,
  LatestJobQueue,
  parseKittyControl,
  validateKittyCommand,
} = require('../../src/renderer/kitty-graphics.js');

const parsed = parseKittyControl('a=T,f=100,t=d,i=31,c=80,r=24,m=0,q=1,z=-1');
assert.deepEqual({ ...parsed }, {
  a: 'T', f: 100, t: 'd', i: 31, c: 80, r: 24, m: 0, q: 1, z: -1,
});
assert.equal(validateKittyCommand(parsed, 128), 'T');
assert.equal(validateKittyCommand(parseKittyControl('a=q,f=24,s=1,v=1,t=d'), 4), 'q');
assert.throws(() => validateKittyCommand(parseKittyControl('a=T,t=f,f=100'), 8), /direct/);
assert.throws(() => validateKittyCommand(parseKittyControl('a=T,t=s,f=100'), 8), /direct/);
assert.throws(() => validateKittyCommand(parseKittyControl('a=T,f=24,s=0,v=1'), 8), /width and height/);
assert.throws(() => validateKittyCommand(parseKittyControl('a=T,f=99'), 8), /pixel format/);
assert.throws(
  () => validateKittyCommand(parseKittyControl('a=T,f=100'), DEFAULT_LIMITS.maxEncodedBytes + 1),
  /encoded payload/,
);

function testCapabilityQuery() {
  let apcHandler;
  const replies = [];
  const activeStates = [];
  const disposable = { dispose() {} };
  const terminal = {
    _core: { _inputHandler: { _parser: { registerApcHandler: (_, handler) => { apcHandler = handler; return disposable; } } } },
    element: { querySelector: () => null },
    onRender: () => disposable,
    onResize: () => disposable,
    input: (data) => replies.push(data),
  };
  const addon = new KittyGraphicsAddon({ onActiveChange: (active) => activeStates.push(active) });
  addon.activate(terminal);
  apcHandler.start();
  const query = 'a=q,t=d,f=100,i=31';
  const data = Uint32Array.from(Array.from(query).map((character) => character.codePointAt(0)));
  apcHandler.put(data, 0, data.length);
  assert.equal(apcHandler.end(true), true);
  assert.deepEqual(replies, ['\x1b_Gi=31;OK\x1b\\']);
  assert.deepEqual(activeStates, []);
  addon.dispose();
}

testCapabilityQuery();

function testParserLimitRejectionIsDiagnosed() {
  let apcHandler;
  const diagnostics = [];
  const disposable = { dispose() {} };
  const terminal = {
    _core: { _inputHandler: { _parser: { registerApcHandler: (_, handler) => { apcHandler = handler; return disposable; } } } },
    element: { querySelector: () => null },
    onRender: () => disposable,
    onResize: () => disposable,
  };
  const addon = new KittyGraphicsAddon({
    limits: { maxEncodedBytes: 2 },
    onErrorDiagnostic: (message) => diagnostics.push(message),
  });
  addon.activate(terminal);
  apcHandler.start();
  const command = 'a=T,f=100;AAAA';
  const data = Uint32Array.from(Array.from(command).map((character) => character.codePointAt(0)));
  apcHandler.put(data, 0, data.length);
  assert.equal(apcHandler.end(true), true);
  assert.deepEqual(diagnostics, ['Kitty graphics rejected: encoded payload exceeds limit']);
  addon.dispose();
}

testParserLimitRejectionIsDiagnosed();

function testFrameAnchorIsCapturedBeforeAsyncDecode() {
  let queued;
  const addon = new KittyGraphicsAddon();
  addon.terminal = {
    buffer: { active: { baseY: 7, cursorY: 2, cursorX: 3 } },
  };
  addon.queue = { push: (_key, job) => { queued = job; } };
  addon._receive({ a: 'T', f: 32, s: 1, v: 1 }, 'AAAAAA==', 'T');
  addon.terminal.buffer.active.baseY = 100;
  addon.terminal.buffer.active.cursorY = 20;
  addon.terminal.buffer.active.cursorX = 30;
  assert.deepEqual(queued.anchor, { line: 9, column: 3 });
}

testFrameAnchorIsCapturedBeforeAsyncDecode();

function testActiveChangeIsDeduplicated() {
  const states = [];
  const addon = new KittyGraphicsAddon({ onActiveChange: (active) => states.push(active) });
  addon._setActive(true);
  addon._setActive(true);
  addon._setActive(false);
  addon._setActive(false);
  assert.deepEqual(states, [true, false]);
}

testActiveChangeIsDeduplicated();

function testImplicitPlacementIsReusedAcrossFrames() {
  const addon = new KittyGraphicsAddon();
  assert.equal(addon._placementIdFor(7, {}), 1);
  addon.placements.set(1, { imageId: 7 });
  assert.equal(addon._placementIdFor(7, {}), 1);
  assert.equal(addon.nextPlacementId, 2);
  assert.equal(addon._placementIdFor(8, { p: 42 }), 42);
}

testImplicitPlacementIsReusedAcrossFrames();

function testUnsupportedDeleteDoesNotRemoveImages() {
  const diagnostics = [];
  const replies = [];
  const addon = new KittyGraphicsAddon({ onErrorDiagnostic: (message) => diagnostics.push(message) });
  addon.terminal = { input: (data) => replies.push(data) };
  addon.images.set(7, { close() { throw new Error('must not close'); } });
  assert.throws(() => addon._delete({ a: 'd', d: 'z', z: 1 }), /unsupported delete selector/);
  assert.equal(addon.images.has(7), true);
  assert.equal(addon.deleteSequence, 0);

  addon.control = 'a=d,d=z,z=1';
  addon.payload = '';
  addon.rejected = false;
  addon._end(true);
  assert.equal(addon.images.has(7), true);
  assert.match(replies[0], /EINVAL:unsupported delete selector d=z/);
  assert.match(diagnostics[0], /unsupported delete selector d=z/);
}

function testCellDeleteRemovesOnlyIntersectingPlacement() {
  const addon = new KittyGraphicsAddon();
  addon.terminal = { buffer: { active: { viewportY: 10 } }, input() {} };
  addon.images.set(7, { close() { throw new Error('must not close stored image'); } });
  addon.images.set(8, { close() { throw new Error('must not close stored image'); } });
  addon.placements.set(41, {
    imageId: 7, line: 11, column: 2, columns: 4, rows: 3, canvas: { remove() {} },
  });
  addon.placements.set(42, {
    imageId: 8, line: 20, column: 20, columns: 2, rows: 2, canvas: { remove() {} },
  });
  addon._delete({ a: 'd', d: 'p', x: 4, y: 3, q: 1 });
  addon._flushDeleteSnapshots(addon.deleteSequence);
  assert.equal(addon.placements.has(41), false);
  assert.equal(addon.placements.has(42), true);
  assert.equal(addon.images.has(7), true);
  assert.equal(addon.images.has(8), true);
}

function testPlacementDeleteDoesNotDeleteStoredImage() {
  const addon = new KittyGraphicsAddon();
  addon.images.set(7, { close() { throw new Error('must not close'); } });
  addon.placements.set(42, { imageId: 7, canvas: { remove() {} } });
  addon._delete({ a: 'd', d: 'i', i: 7, p: 42, q: 1 });
  addon._flushDeleteSnapshots(addon.deleteSequence);
  assert.equal(addon.images.has(7), true);
  assert.equal(addon.placements.has(42), false);
}

function testDeleteBarrierIsPrunedWithoutPendingDecode() {
  const addon = new KittyGraphicsAddon();
  for (let imageId = 1; imageId <= 100; imageId += 1) {
    addon._delete({ a: 'd', d: 'i', i: imageId, q: 1 });
  }
  addon._clearPendingDeletes();
  assert.equal(addon.imageDeleteSequences.size, 0);
}

testUnsupportedDeleteDoesNotRemoveImages();
testCellDeleteRemovesOnlyIntersectingPlacement();
testPlacementDeleteDoesNotDeleteStoredImage();
testDeleteBarrierIsPrunedWithoutPendingDecode();

async function testReplacementAtomicallyDeletesPreviousFrame() {
  const addon = new KittyGraphicsAddon();
  addon.terminal = { rows: 24, buffer: { active: { viewportY: 0 } }, input() {} };
  const removed = [];
  addon.images.set(7, { close: () => removed.push('image:7') });
  addon.placements.set(1, {
    imageId: 7, line: 0, rows: 2, canvas: { remove: () => removed.push('placement:1') },
  });
  addon._delete({ a: 'd', d: 'a', q: 1 });
  assert.notEqual(addon.pendingDeleteTimer, null);
  let queued;
  addon.queue = { push: (_key, job) => { queued = job; } };
  addon._receive({ a: 'T', f: 32, s: 1, v: 1, i: 8 }, 'AAAAAA==', 'T');
  assert.notEqual(addon.pendingDeleteTimer, null);
  assert.equal(queued.deleteThrough, 1);
  addon.images.set(8, { close() {} });
  addon.placements.set(2, { imageId: 8, canvas: { remove: () => removed.push('placement:2') } });
  addon._flushDeleteSnapshots(queued.deleteThrough, 8, 2);
  assert.deepEqual(removed, ['placement:1']);
  assert.equal(addon.images.has(7), true);
  assert.equal(addon.images.has(8), true);
  assert.equal(addon.placements.has(2), true);
  assert.equal(addon.deleteSnapshots.size, 0);
}

function testCapabilityQueryKeepsDeleteFallbackArmed() {
  const addon = new KittyGraphicsAddon();
  addon.terminal = { rows: 24, buffer: { active: { viewportY: 0 } }, input() {} };
  addon.images.set(7, { close() {} });
  addon.placements.set(1, { imageId: 7, line: 0, rows: 2, canvas: { remove() {} } });
  addon._delete({ a: 'd', d: 'a', q: 1 });
  const fallback = addon.pendingDeleteTimer;
  addon._receive({ a: 'q', i: 31 }, '', 'q');
  assert.equal(addon.pendingDeleteTimer, fallback);
  assert.equal(addon.deleteSnapshots.size, 1);
  addon._clearPendingDeletes();
}

async function testDecodeFailureFlushesPreviousDelete() {
  const addon = new KittyGraphicsAddon();
  addon.terminal = { rows: 24, buffer: { active: { viewportY: 0 } }, input() {} };
  addon.images.set(7, { close() {} });
  addon.placements.set(1, { imageId: 7, line: 0, rows: 2, canvas: { remove() {} } });
  addon._delete({ a: 'd', d: 'a', q: 1 });
  await addon._decodeAndDisplay({
    command: { i: 8, f: 32, s: 1, v: 1, q: 1 },
    payload: 'invalid',
    display: true,
    anchor: { line: 0, column: 0 },
    generation: addon.generation,
    deleteThrough: addon.deleteSequence,
  });
  assert.equal(addon.images.has(7), true);
  assert.equal(addon.placements.has(1), false);
  assert.equal(addon.deleteSnapshots.size, 0);
  addon._clearPendingDeletes();
}

function testDeleteAllCaseAndVisibilitySemantics() {
  const removed = [];
  const addon = new KittyGraphicsAddon();
  addon.terminal = { rows: 10, buffer: { active: { viewportY: 5 } }, input() {} };
  addon.images.set(7, { close: () => removed.push('image:7') });
  addon.images.set(8, { close: () => removed.push('image:8') });
  addon.placements.set(1, {
    imageId: 7, line: 6, rows: 2, canvas: { remove: () => removed.push('placement:1') },
  });
  addon.placements.set(2, {
    imageId: 8, line: 30, rows: 2, canvas: { remove: () => removed.push('placement:2') },
  });
  addon._delete({ a: 'd', d: 'a', q: 1 });
  addon._flushDeleteSnapshots(addon.deleteSequence);
  assert.deepEqual(removed, ['placement:1']);
  assert.equal(addon.images.has(7), true);
  assert.equal(addon.images.has(8), true);
  assert.equal(addon.placements.has(2), true);

  addon.placements.set(3, {
    imageId: 7, line: 6, rows: 2, canvas: { remove: () => removed.push('placement:3') },
  });
  addon._delete({ a: 'd', d: 'A', q: 1 });
  addon._flushDeleteSnapshots(addon.deleteSequence);
  assert.deepEqual(removed, ['placement:1', 'image:7', 'placement:3']);
  assert.equal(addon.images.has(7), false);
  assert.equal(addon.images.has(8), true);
  assert.equal(addon.placements.has(2), true);
  addon._clearPendingDeletes();
}

testCapabilityQueryKeepsDeleteFallbackArmed();
testDeleteAllCaseAndVisibilitySemantics();

async function testResetInvalidatesInFlightDecode() {
  const replies = [];
  let releaseBitmap;
  const addon = new KittyGraphicsAddon();
  addon.terminal = { input: (data) => replies.push(data) };
  addon._createBitmap = () => new Promise((resolve) => {
    releaseBitmap = () => resolve({ width: 1, height: 1, close() {} });
  });
  const pending = addon._decodeAndDisplay({
    command: { i: 1, f: 100 },
    payload: '',
    display: true,
    anchor: { line: 0, column: 0 },
    generation: addon.generation,
  });
  while (!releaseBitmap) await Promise.resolve();
  addon.reset();
  releaseBitmap();
  await pending;
  assert.deepEqual(replies, []);
  assert.equal(addon.images.size, 0);
  assert.equal(addon.placements.size, 0);
}

async function testDeleteInvalidatesInFlightDecode() {
  let releaseBitmap;
  let bitmapClosed = false;
  const addon = new KittyGraphicsAddon();
  addon.terminal = { input() {} };
  addon._createBitmap = () => new Promise((resolve) => {
    releaseBitmap = () => resolve({
      width: 1,
      height: 1,
      close: () => { bitmapClosed = true; },
    });
  });
  const pending = addon._decodeAndDisplay({
    command: { i: 7, f: 100, q: 1 },
    payload: '',
    display: true,
    anchor: { line: 0, column: 0 },
    generation: addon.generation,
    deleteThrough: addon.deleteSequence,
  });
  while (!releaseBitmap) await Promise.resolve();
  addon._delete({ a: 'd', d: 'a', q: 1 });
  releaseBitmap();
  await pending;
  addon._clearPendingDeletes();
  assert.equal(bitmapClosed, true);
  assert.equal(addon.images.size, 0);
  assert.equal(addon.placements.size, 0);
}

async function testLatestFrameWins() {
  const started = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const queue = new LatestJobQueue(async (job) => {
    started.push(job);
    if (job === 'first') await firstGate;
  });
  queue.push('image:1', 'first');
  queue.push('image:1', 'stale');
  queue.push('image:1', 'latest');
  await Promise.resolve();
  releaseFirst();
  while (queue.running) await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(started, ['first', 'latest']);
}

Promise.all([
  testLatestFrameWins(),
  testResetInvalidatesInFlightDecode(),
  testDeleteInvalidatesInFlightDecode(),
  testDecodeFailureFlushesPreviousDelete(),
  testReplacementAtomicallyDeletesPreviousFrame(),
]).then(() => {
  process.stdout.write('kitty graphics tests passed\n');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
