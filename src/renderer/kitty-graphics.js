(function attachKittyGraphics(root, factory) {
  const exports = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exports;
  }
  if (root) {
    root.FpasotermKittyGraphics = exports;
  }
}(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';

  const DEFAULT_LIMITS = Object.freeze({
    maxEncodedBytes: 12 * 1024 * 1024,
    maxDecodedBytes: 8 * 1024 * 1024,
    maxPixels: 4 * 1024 * 1024,
    maxImages: 8,
    maxPlacements: 8,
    maxControlBytes: 512,
  });

  function parseKittyControl(value) {
    const command = Object.create(null);
    for (const field of String(value || '').split(',')) {
      const separator = field.indexOf('=');
      if (separator < 1) continue;
      const key = field.slice(0, separator);
      const raw = field.slice(separator + 1);
      if (['a', 'o', 't', 'd'].includes(key)) {
        command[key] = raw;
        continue;
      }
      if (!/^-?\d+$/.test(raw)) continue;
      const number = Number(raw);
      if (Number.isSafeInteger(number)) command[key] = number;
    }
    return command;
  }

  function validateKittyCommand(command, encodedLength, limits = DEFAULT_LIMITS) {
    const action = command.a || 'T';
    if (!['q', 't', 'T', 'p', 'd'].includes(action)) throw new Error('unsupported action');
    if (encodedLength > limits.maxEncodedBytes) throw new Error('encoded payload exceeds limit');
    if (command.t && command.t !== 'd') throw new Error('only direct transmission is supported');
    if (command.o && command.o !== 'z') throw new Error('unsupported compression');
    if (command.f !== undefined && ![24, 32, 100].includes(command.f)) throw new Error('unsupported pixel format');
    if ([24, 32].includes(command.f) && (!(command.s > 0) || !(command.v > 0))) {
      throw new Error('raw images require width and height');
    }
    if ((command.s || 0) * (command.v || 0) > limits.maxPixels) throw new Error('image exceeds pixel limit');
    return action;
  }

  class LatestJobQueue {
    constructor(run) {
      this.run = run;
      this.pending = new Map();
      this.running = false;
    }

    push(key, job) {
      this.pending.set(key, job);
      this._drain();
    }

    async _drain() {
      if (this.running) return;
      this.running = true;
      try {
        while (this.pending.size) {
          const entries = Array.from(this.pending.entries());
          this.pending.clear();
          const [key, job] = entries[entries.length - 1];
          await this.run(job, key);
        }
      } finally {
        this.running = false;
      }
    }

    clear() {
      this.pending.clear();
    }
  }

  function decodeBase64(payload, maxDecodedBytes) {
    const normalized = String(payload || '').replace(/\s/g, '');
    const expected = Math.floor(normalized.length * 3 / 4);
    if (expected > maxDecodedBytes) throw new Error('decoded payload exceeds limit');
    const binary = atob(normalized);
    if (binary.length > maxDecodedBytes) throw new Error('decoded payload exceeds limit');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  async function inflateZlib(bytes, maxDecodedBytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('zlib is unavailable');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxDecodedBytes) {
        await reader.cancel();
        throw new Error('inflated payload exceeds limit');
      }
      chunks.push(value);
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }

  class KittyGraphicsAddon {
    constructor(options = {}) {
      this.limits = Object.freeze({ ...DEFAULT_LIMITS, ...(options.limits || {}) });
      this.onDiagnostic = typeof options.onDiagnostic === 'function' ? options.onDiagnostic : () => {};
      this.images = new Map();
      this.placements = new Map();
      this.chunks = null;
      this.nextImageId = 1;
      this.nextPlacementId = 1;
      this.disposables = [];
      this.queue = new LatestJobQueue((job) => this._decodeAndDisplay(job));
    }

    activate(terminal) {
      this.terminal = terminal;
      const parser = terminal?._core?._inputHandler?._parser;
      if (!parser || typeof parser.registerApcHandler !== 'function') {
        throw new Error('xterm APC parser is unavailable');
      }
      const handler = {
        start: () => {
          this.control = '';
          this.payload = '';
          this.inControl = true;
          this.rejected = false;
        },
        put: (data, start, end) => this._put(data, start, end),
        end: (success) => this._end(success),
      };
      this.disposables.push(parser.registerApcHandler({ final: 'G' }, handler));
      this.disposables.push(terminal.onRender(() => this._renderPlacements()));
      this.disposables.push(terminal.onResize(() => this._renderPlacements()));
      this._ensureLayer();
    }

    _put(data, start, end) {
      if (this.rejected) return;
      for (let index = start; index < end; index += 1) {
        const character = String.fromCodePoint(data[index]);
        if (this.inControl && character === ';') {
          this.inControl = false;
          continue;
        }
        if (this.inControl) {
          this.control += character;
          if (this.control.length > this.limits.maxControlBytes) this.rejected = true;
        } else {
          this.payload += character;
          if (this.payload.length > this.limits.maxEncodedBytes) this.rejected = true;
        }
      }
    }

    _end(success) {
      if (!success || this.rejected) return true;
      const command = parseKittyControl(this.control);
      try {
        const action = validateKittyCommand(command, this.payload.length, this.limits);
        if (action === 'd') this._delete(command);
        else if (action === 'p') this._placeStored(command);
        else this._receive(command, this.payload, action);
      } catch (error) {
        this._respond(command, `EINVAL:${error.message}`, false);
        this.onDiagnostic(`Kitty graphics rejected: ${error.message}`);
      }
      return true;
    }

    _receive(command, payload, action) {
      if (command.m === 1) {
        if (!this.chunks) this.chunks = { command: { ...command }, payload: '' };
        this.chunks.payload += payload;
        if (this.chunks.payload.length > this.limits.maxEncodedBytes) {
          this.chunks = null;
          throw new Error('chunked payload exceeds limit');
        }
        return;
      }
      if (this.chunks) {
        payload = this.chunks.payload + payload;
        command = { ...this.chunks.command, ...command, m: 0 };
        this.chunks = null;
      }
      if (action === 'q') {
        this._respond(command, 'OK', true);
        return;
      }
      const id = command.i || this.nextImageId++;
      const key = `image:${id}`;
      this.queue.push(key, { command: { ...command, i: id }, payload, display: action === 'T' });
    }

    async _decodeAndDisplay(job) {
      const { command } = job;
      try {
        let bytes = decodeBase64(job.payload, this.limits.maxDecodedBytes);
        if (command.o === 'z') bytes = await inflateZlib(bytes, this.limits.maxDecodedBytes);
        const bitmap = await this._createBitmap(command, bytes);
        if (bitmap.width * bitmap.height > this.limits.maxPixels) {
          bitmap.close();
          throw new Error('decoded image exceeds pixel limit');
        }
        this._storeImage(command.i, bitmap);
        if (job.display) this._createPlacement(command.i, command);
        this._respond(command, 'OK', true);
        this.onDiagnostic(`Kitty graphics rendered id=${command.i} ${bitmap.width}x${bitmap.height}`);
      } catch (error) {
        this._respond(command, `EINVAL:${error.message}`, false);
        this.onDiagnostic(`Kitty graphics decode failed: ${error.message}`);
      }
    }

    async _createBitmap(command, bytes) {
      if (command.f === 100 || command.f === undefined) {
        return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      }
      const width = command.s;
      const height = command.v;
      const pixelCount = width * height;
      const expected = pixelCount * (command.f === 32 ? 4 : 3);
      if (bytes.byteLength !== expected) throw new Error('raw pixel payload has an invalid length');
      if (command.f === 32) {
        return createImageBitmap(new ImageData(new Uint8ClampedArray(bytes), width, height));
      }
      const rgba = new Uint8ClampedArray(pixelCount * 4);
      for (let source = 0, target = 0; source < bytes.length; source += 3, target += 4) {
        rgba[target] = bytes[source];
        rgba[target + 1] = bytes[source + 1];
        rgba[target + 2] = bytes[source + 2];
        rgba[target + 3] = 255;
      }
      return createImageBitmap(new ImageData(rgba, width, height));
    }

    _storeImage(id, bitmap) {
      const previous = this.images.get(id);
      previous?.close?.();
      this.images.delete(id);
      this.images.set(id, bitmap);
      while (this.images.size > this.limits.maxImages) {
        const oldestId = this.images.keys().next().value;
        this._deleteImage(oldestId);
      }
      for (const placement of this.placements.values()) {
        if (placement.imageId === id) this._paintPlacement(placement);
      }
    }

    _ensureLayer() {
      if (this.layer?.isConnected) return true;
      const screen = this.terminal?.element?.querySelector('.xterm-screen');
      if (!screen) return false;
      const layer = document.createElement('div');
      layer.className = 'fpasoterm-kitty-graphics-layer';
      screen.appendChild(layer);
      this.layer = layer;
      return true;
    }

    _createPlacement(imageId, command) {
      if (!this.images.has(imageId) || !this._ensureLayer()) return;
      const placementId = command.p || this.nextPlacementId++;
      const existing = this.placements.get(placementId);
      existing?.canvas.remove();
      existing?.marker.dispose();
      const canvas = document.createElement('canvas');
      canvas.className = 'fpasoterm-kitty-placement';
      canvas.dataset.imageId = String(imageId);
      this.layer.appendChild(canvas);
      const placement = {
        id: placementId,
        imageId,
        canvas,
        marker: this.terminal.registerMarker(0),
        column: this.terminal.buffer.active.cursorX,
        columns: command.c,
        rows: command.r,
        xOffset: command.X || 0,
        yOffset: command.Y || 0,
        zIndex: command.z || 0,
      };
      this.placements.set(placementId, placement);
      while (this.placements.size > this.limits.maxPlacements) {
        this._deletePlacement(this.placements.keys().next().value);
      }
      this._paintPlacement(placement);
      this._renderPlacements();
    }

    _placeStored(command) {
      const id = command.i;
      if (!id || !this.images.has(id)) throw new Error('unknown image id');
      this._createPlacement(id, command);
      this._respond(command, 'OK', true);
    }

    _paintPlacement(placement) {
      const bitmap = this.images.get(placement.imageId);
      if (!bitmap) return;
      placement.canvas.width = bitmap.width;
      placement.canvas.height = bitmap.height;
      const context = placement.canvas.getContext('2d', { alpha: true });
      context?.clearRect(0, 0, bitmap.width, bitmap.height);
      context?.drawImage(bitmap, 0, 0);
    }

    _renderPlacements() {
      if (!this._ensureLayer()) return;
      const rect = this.terminal.element.querySelector('.xterm-screen')?.getBoundingClientRect();
      if (!rect || !this.terminal.cols || !this.terminal.rows) return;
      const cellWidth = rect.width / this.terminal.cols;
      const cellHeight = rect.height / this.terminal.rows;
      const viewportY = this.terminal.buffer.active.viewportY;
      for (const placement of this.placements.values()) {
        const row = placement.marker.line - viewportY;
        placement.canvas.hidden = row < -this.terminal.rows || row >= this.terminal.rows;
        placement.canvas.style.left = `${placement.column * cellWidth + placement.xOffset}px`;
        placement.canvas.style.top = `${row * cellHeight + placement.yOffset}px`;
        placement.canvas.style.width = placement.columns ? `${placement.columns * cellWidth}px` : `${placement.canvas.width}px`;
        placement.canvas.style.height = placement.rows ? `${placement.rows * cellHeight}px` : `${placement.canvas.height}px`;
        placement.canvas.style.zIndex = String(Math.max(-1, Math.min(1, placement.zIndex)));
      }
    }

    _delete(command) {
      const selector = command.d || 'a';
      if (selector.toLowerCase() === 'a') this.reset();
      else if (selector.toLowerCase() === 'i' && command.i) this._deleteImage(command.i);
      this._respond(command, 'OK', true);
    }

    _deleteImage(id) {
      this.images.get(id)?.close?.();
      this.images.delete(id);
      for (const [placementId, placement] of this.placements) {
        if (placement.imageId === id) this._deletePlacement(placementId);
      }
    }

    _deletePlacement(id) {
      const placement = this.placements.get(id);
      if (!placement) return;
      placement.marker?.dispose?.();
      placement.canvas?.remove?.();
      this.placements.delete(id);
    }

    _respond(command, message, success) {
      const quiet = command?.q || 0;
      if ((success && quiet >= 1) || (!success && quiet >= 2)) return;
      const id = command?.i ? `i=${command.i};` : '';
      this.terminal?.input?.(`\x1b_G${id}${message}\x1b\\`, false);
    }

    reset() {
      this.queue.clear();
      this.chunks = null;
      for (const id of Array.from(this.placements.keys())) this._deletePlacement(id);
      for (const bitmap of this.images.values()) bitmap.close?.();
      this.images.clear();
    }

    dispose() {
      this.reset();
      for (const disposable of this.disposables.splice(0)) disposable?.dispose?.();
      this.layer?.remove?.();
      this.layer = null;
    }
  }

  return { DEFAULT_LIMITS, KittyGraphicsAddon, LatestJobQueue, parseKittyControl, validateKittyCommand };
}));
