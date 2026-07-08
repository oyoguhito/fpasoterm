const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const size = 256;
const pixels = Buffer.alloc(size * size * 4);

function setPixel(x, y, r, g, b, a = 255) {
  const offset = (y * size + x) * 4;
  pixels[offset] = r;
  pixels[offset + 1] = g;
  pixels[offset + 2] = b;
  pixels[offset + 3] = a;
}

function fillRect(x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      setPixel(col, row, ...color);
    }
  }
}

function fillRoundedRect(x, y, width, height, radius, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      const dx = Math.max(x - col + radius, 0, col - (x + width - radius - 1));
      const dy = Math.max(y - row + radius, 0, row - (y + height - radius - 1));
      if ((dx * dx) + (dy * dy) <= radius * radius) {
        setPixel(col, row, ...color);
      }
    }
  }
}

function strokeRect(x, y, width, height, thickness, color) {
  fillRect(x, y, width, thickness, color);
  fillRect(x, y + height - thickness, width, thickness, color);
  fillRect(x, y, thickness, height, color);
  fillRect(x + width - thickness, y, thickness, height, color);
}

function line(x0, y0, x1, y1, thickness, color) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;

  while (true) {
    fillRoundedRect(x - thickness, y - thickness, thickness * 2, thickness * 2, thickness, color);
    if (x === x1 && y === y1) {
      break;
    }
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const shade = Math.round(18 + (x + y) * 0.08);
    setPixel(x, y, shade, shade + 8, shade + 18);
  }
}

fillRoundedRect(32, 48, 192, 152, 18, [10, 16, 24, 255]);
strokeRect(32, 48, 192, 152, 7, [61, 75, 95, 255]);
fillRoundedRect(48, 64, 160, 24, 6, [26, 34, 48, 255]);
fillRoundedRect(61, 71, 10, 10, 5, [255, 107, 107, 255]);
fillRoundedRect(81, 71, 10, 10, 5, [245, 215, 110, 255]);
fillRoundedRect(101, 71, 10, 10, 5, [139, 209, 124, 255]);
line(67, 119, 94, 140, 5, [143, 211, 255, 255]);
line(94, 140, 67, 161, 5, [143, 211, 255, 255]);
fillRoundedRect(108, 156, 56, 14, 7, [232, 237, 242, 255]);
fillRoundedRect(145, 105, 60, 48, 12, [245, 215, 110, 255]);
fillRoundedRect(158, 118, 34, 10, 5, [16, 21, 29, 255]);
fillRoundedRect(158, 135, 34, 10, 5, [16, 21, 29, 255]);
fillRoundedRect(64, 216, 128, 8, 4, [245, 215, 110, 255]);

const raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y += 1) {
  const rowStart = y * (size * 4 + 1);
  raw[rowStart] = 0;
  pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outputPath = path.join(root, 'extra', 'logo', 'fpasoterm.png');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, png);
console.log(outputPath);
