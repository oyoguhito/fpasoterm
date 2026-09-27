const assert = require('node:assert/strict');
const {
  closePluginCommandStatus,
  runPluginCommand,
} = require('../../src/renderer/plugin-command-runtime.js');

async function main() {
  const statuses = [];
  const diagnostics = [];
  let menuClosed = 0;
  let depth = 0;
  const commands = new Map([
    ['example.ok', { handler: async (args) => assert.deepEqual(args, { value: 42 }) }],
    ['example.fail', { handler: async () => { throw new TypeError('expected plugin failure'); } }],
  ]);
  const callbacks = {
    commands,
    closeMenu: () => { menuClosed += 1; },
    showStatus: (message, state) => statuses.push({ message, state: state || 'progress' }),
    showDiagnostic: (message) => diagnostics.push(message),
    begin: () => { depth += 1; },
    finish: () => { depth -= 1; },
  };

  const success = await runPluginCommand({ ...callbacks, commandId: 'example.ok', args: { value: 42 } });
  assert.deepEqual(success, { ran: true, ok: true });
  assert.deepEqual(statuses.slice(0, 2), [
    { message: 'command started: example.ok', state: 'progress' },
    { message: 'command completed: example.ok', state: 'progress' },
  ]);
  assert.equal(depth, 0);

  const failure = await runPluginCommand({ ...callbacks, commandId: 'example.fail' });
  assert.equal(failure.ran, true);
  assert.equal(failure.ok, false);
  assert.match(failure.detail, /TypeError/);
  assert.match(failure.detail, /expected plugin failure/);
  assert.deepEqual(statuses.at(-1).state, 'error');
  assert.match(statuses.at(-1).message, /command failed: example\.fail/);
  assert.match(diagnostics.at(-1), /plugin command example\.fail failed/);
  assert.equal(depth, 0);

  const statusCount = statuses.length;
  const missing = await runPluginCommand({ ...callbacks, commandId: 'example.missing' });
  assert.deepEqual(missing, { ran: false, ok: false });
  assert.equal(statuses.length, statusCount);
  assert.equal(depth, 0);

  const panel = { hidden: false };
  let focused = 0;
  closePluginCommandStatus(panel, () => { focused += 1; });
  assert.equal(panel.hidden, true);
  assert.equal(focused, 1);
}

main().then(
  () => process.stdout.write('plugin command runtime tests passed\n'),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
