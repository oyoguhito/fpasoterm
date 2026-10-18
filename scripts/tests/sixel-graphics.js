const assert = require('node:assert/strict');

const { ImageAddon } = require('../../src/renderer/vendor/addon-image/addon-image.js');

assert.equal(typeof ImageAddon, 'function');

const addon = new ImageAddon({
  sixelSupport: true,
  sixelSizeLimit: 8 * 1024 * 1024,
  sixelPaletteLimit: 256,
  pixelLimit: 4 * 1024 * 1024,
  storageLimit: 8,
  iipSupport: false,
  kittySupport: false,
});

assert.equal(addon._opts.sixelSupport, true);
assert.equal(addon._opts.sixelSizeLimit, 8 * 1024 * 1024);
assert.equal(addon._opts.sixelPaletteLimit, 256);
assert.equal(addon._opts.pixelLimit, 4 * 1024 * 1024);
assert.equal(addon._opts.storageLimit, 8);
assert.equal(addon._opts.iipSupport, false);
assert.equal(addon._opts.kittySupport, false);

addon.dispose();
console.log('sixel graphics configuration tests passed');
