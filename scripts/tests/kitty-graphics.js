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
  const disposable = { dispose() {} };
  const terminal = {
    _core: { _inputHandler: { _parser: { registerApcHandler: (_, handler) => { apcHandler = handler; return disposable; } } } },
    element: { querySelector: () => null },
    onRender: () => disposable,
    onResize: () => disposable,
    input: (data) => replies.push(data),
  };
  const addon = new KittyGraphicsAddon();
  addon.activate(terminal);
  apcHandler.start();
  const query = 'a=q,t=d,f=100,i=31';
  const data = Uint32Array.from(Array.from(query).map((character) => character.codePointAt(0)));
  apcHandler.put(data, 0, data.length);
  assert.equal(apcHandler.end(true), true);
  assert.deepEqual(replies, ['\x1b_Gi=31;OK\x1b\\']);
  addon.dispose();
}

testCapabilityQuery();

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

testLatestFrameWins().then(() => {
  process.stdout.write('kitty graphics tests passed\n');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
