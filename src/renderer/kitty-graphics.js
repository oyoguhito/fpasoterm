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

  function describePngBytes(bytes) {
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    const iend = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
    const hasPrefix = bytes.length >= pngSignature.length
      && pngSignature.every((value, index) => bytes[index] === value);
    const hasIend = bytes.length >= iend.length
      && iend.every((value, index) => bytes[bytes.length - iend.length + index] === value);
    return `png-bytes=${bytes.length} signature=${hasPrefix ? 'ok' : 'invalid'} iend=${hasIend ? 'ok' : 'missing'}`;
  }

  function pngDimensions(bytes) {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) {
      throw new Error('PNG signature is invalid');
    }
    if (String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') {
      throw new Error('PNG header is missing IHDR');
    }
    const width = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
    const height = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
    if (!(width > 0) || !(height > 0)) throw new Error('PNG has invalid dimensions');
    return { width, height };
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
      this.onErrorDiagnostic = typeof options.onErrorDiagnostic === 'function'
        ? options.onErrorDiagnostic
        : this.onDiagnostic;
      // A complete browser frame can be too noisy for the ordinary live log,
      // but the first one is the critical protocol boundary when diagnosing a
      // black graphics pane. Keep it visible even when --debug-keys is off.
      this.onFrameDiagnostic = typeof options.onFrameDiagnostic === 'function'
        ? options.onFrameDiagnostic
        : this.onDiagnostic;
      this.onActiveChange = typeof options.onActiveChange === 'function' ? options.onActiveChange : () => {};
      this.firstTransferReported = false;
      this.firstRenderReported = false;
      this.active = false;
      this.images = new Map();
      this.placements = new Map();
      this.chunks = null;
      this.nextImageId = 1;
      this.nextPlacementId = 1;
      this.generation = 0;
      this.deleteSequence = 0;
      this.deleteAllSequence = 0;
      this.imageDeleteSequences = new Map();
      this.activeDecodeImageIds = new Set();
      this.deleteSnapshots = new Map();
      this.pendingDeleteSequence = null;
      this.pendingDeleteTimer = null;
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
          this.rejectionReason = '';
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
          if (this.control.length > this.limits.maxControlBytes) {
            this.rejected = true;
            this.rejectionReason = 'control data exceeds limit';
          }
        } else {
          this.payload += character;
          if (this.payload.length > this.limits.maxEncodedBytes) {
            this.rejected = true;
            this.rejectionReason = 'encoded payload exceeds limit';
          }
        }
      }
    }

    _end(success) {
      if (!success) return true;
      if (this.rejected) {
        this._flushDeleteSnapshots(this.deleteSequence);
        this.onErrorDiagnostic(`Kitty graphics rejected: ${this.rejectionReason || 'parser limit exceeded'}`);
        return true;
      }
      const command = parseKittyControl(this.control);
      try {
        const action = validateKittyCommand(command, this.payload.length, this.limits);
        if (action === 'd') this._delete(command);
        else if (action === 'p') this._placeStored(command);
        else this._receive(command, this.payload, action);
      } catch (error) {
        // A preceding delete remains authoritative even when its attempted
        // replacement is rejected before decode. Do not leave the old frame
        // pinned merely because the next APC was malformed or unsupported.
        this._flushDeleteSnapshots(this.deleteSequence);
        this._respond(command, `EINVAL:${error.message}`, false);
        this.onErrorDiagnostic(`Kitty graphics rejected: ${error.message}`);
      }
      return true;
    }

    // Windows ConPTY consumes APC (`ESC _`) sequences before a terminal host
    // can parse them.  fpasobrowser therefore puts the same Kitty control and
    // base64 payload in fpasoterm's private OSC 777 channel on Windows.  Keep
    // parsing here so both transports share validation, chunk assembly,
    // decode limits, placement, and diagnostics.
    receiveFpasotermOsc(value) {
      const prefix = 'graphics;v=1;';
      const body = String(value || '');
      if (!body.startsWith(prefix)) return false;
      const message = body.slice(prefix.length);
      const separator = message.indexOf(';');
      if (separator < 1) {
        this.onErrorDiagnostic('fpasoterm graphics rejected: missing Kitty control data');
        return true;
      }
      const control = message.slice(0, separator);
      const payload = message.slice(separator + 1);
      const command = parseKittyControl(control);
      try {
        const action = validateKittyCommand(command, payload.length, this.limits);
        if (action === 'd') this._delete(command);
        else if (action === 'p') this._placeStored(command);
        // The OSC bridge is flushed after xterm has consumed the surrounding
        // terminal write. fpasobrowser's toolbar/status bytes can therefore
        // advance xterm's live cursor after the sender's adjacent `CSI H` was
        // parsed. This private bridge is exclusively its full-pane renderer,
        // so retain the intended home anchor instead of sampling that later
        // cursor and clipping the frame to the right/bottom of the pane.
        else this._receive(command, payload, action, 'fpasoterm-osc', { line: 0, column: 0 });
      } catch (error) {
        this._flushDeleteSnapshots(this.deleteSequence);
        this._respond(command, `EINVAL:${error.message}`, false);
        this.onErrorDiagnostic(`fpasoterm graphics rejected: ${error.message}`);
      }
      return true;
    }

    _receive(command, payload, action, transport = 'kitty', anchorOverride = null) {
      // Only the first chunk carries a format field.  Record that boundary so
      // diagnostics can distinguish an application that never emitted a Kitty
      // frame from one whose subsequent decode or placement failed.
      if (command.f !== undefined) {
        const dimensions = command.s && command.v ? ` ${command.s}x${command.v}` : '';
        const protocol = transport === 'fpasoterm-osc' ? 'fpasoterm graphics' : 'Kitty graphics';
        const message = `${protocol} transfer received id=${command.i || 'implicit'} action=${action} format=${command.f}${dimensions} cells=${command.c || 'auto'}x${command.r || 'auto'} compression=${command.o || 'none'}`;
        if (!this.firstTransferReported) {
          this.firstTransferReported = true;
          this.onFrameDiagnostic(message);
        } else {
          this.onDiagnostic(message);
        }
      }
      if (command.m === 1) {
        if (!this.chunks) {
          this.chunks = {
            command: { ...command },
            payload: '',
            anchorOverride,
          };
        }
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
        anchorOverride = this.chunks.anchorOverride;
        this.chunks = null;
      }
      if (action === 'q') {
        this._respond(command, 'OK', true);
        return;
      }
      const id = command.i || this.nextImageId++;
      const key = `image:${id}`;
      // Decoding a full terminal-browser frame is asynchronous. Capture the
      // cursor anchor while the APC is parsed; reading it after decompression
      // can place the image at a cursor position belonging to later output.
      const anchor = anchorOverride || this._captureAnchor();
      this.queue.push(key, {
        command: { ...command, i: id },
        payload,
        display: action === 'T',
        anchor,
        generation: this.generation,
        deleteThrough: this.deleteSequence,
        transport,
      });
    }

    _captureAnchor() {
      const buffer = this.terminal?.buffer?.active;
      return {
        line: (buffer?.baseY || 0) + (buffer?.cursorY || 0),
        column: buffer?.cursorX || 0,
      };
    }

    async _decodeAndDisplay(job) {
      const { command } = job;
      this.activeDecodeImageIds.add(command.i);
      let imageDiagnostics = '';
      try {
        if (this._jobWasDeleted(job)) {
          this._discardDeletedJob(job);
          return;
        }
        let bytes = decodeBase64(job.payload, this.limits.maxDecodedBytes);
        if (command.o === 'z') bytes = await inflateZlib(bytes, this.limits.maxDecodedBytes);
        if (command.f === 100 || command.f === undefined) imageDiagnostics = describePngBytes(bytes);
        if (job.generation !== this.generation) return;
        if (this._jobWasDeleted(job)) {
          this._discardDeletedJob(job);
          return;
        }
        const bitmap = await this._createBitmap(command, bytes, job.transport);
        if (job.generation !== this.generation) {
          bitmap.close?.();
          return;
        }
        if (this._jobWasDeleted(job)) {
          bitmap.close?.();
          this._discardDeletedJob(job);
          return;
        }
        if (bitmap.width * bitmap.height > this.limits.maxPixels) {
          bitmap.close();
          throw new Error('decoded image exceeds pixel limit');
        }
        this._storeImage(command.i, bitmap);
        const placementId = job.display
          ? this._createPlacement(command.i, command, job.anchor)
          : null;
        this._flushDeleteSnapshots(job.deleteThrough, command.i, placementId);
        this._respond(command, 'OK', true);
        const paintPath = bitmap.imageUrl
          ? 'png-html-image'
          : bitmap.imageData
            ? 'raw-rgba-putImageData'
            : 'image-bitmap-drawImage';
        const protocol = job.transport === 'fpasoterm-osc' ? 'fpasoterm graphics' : 'Kitty graphics';
        const message = `${protocol} rendered id=${command.i} ${bitmap.width}x${bitmap.height} format=${command.f || 100} paint=${paintPath}`;
        if (!this.firstRenderReported) {
          this.firstRenderReported = true;
          this.onFrameDiagnostic(message);
        } else {
          this.onDiagnostic(message);
        }
      } catch (error) {
        if (job.generation !== this.generation) return;
        // Successful replacements flush the same snapshots after paint. A
        // failed replacement must also finish the preceding delete rather than
        // keeping a stale placement visible until the fallback timer expires.
        this._flushDeleteSnapshots(job.deleteThrough);
        this._respond(command, `EINVAL:${error.message}`, false);
        const protocol = job.transport === 'fpasoterm-osc' ? 'fpasoterm graphics' : 'Kitty graphics';
        const details = imageDiagnostics ? ` (${imageDiagnostics})` : '';
        this.onErrorDiagnostic(`${protocol} decode failed: ${error.message}${details}`);
      } finally {
        this.activeDecodeImageIds.delete(command.i);
        this._pruneImageDeleteSequences();
      }
    }

    _pruneImageDeleteSequences() {
      const pendingIds = new Set(Array.from(this.queue?.pending?.keys?.() || [])
        .map((key) => /^image:(\d+)$/.exec(String(key)))
        .filter(Boolean)
        .map((match) => Number(match[1])));
      for (const imageId of this.imageDeleteSequences.keys()) {
        if (!this.activeDecodeImageIds.has(imageId) && !pendingIds.has(imageId)) {
          this.imageDeleteSequences.delete(imageId);
        }
      }
    }

    _jobWasDeleted(job) {
      const imageDeleteSequence = this.imageDeleteSequences.get(job.command.i) || 0;
      return job.deleteThrough < this.deleteAllSequence
        || job.deleteThrough < imageDeleteSequence;
    }

    _discardDeletedJob(job) {
      this._respond(job.command, 'OK', true);
      this.onDiagnostic(`Kitty graphics discarded deleted decode id=${job.command.i}`);
    }

    async _createBitmap(command, bytes, transport = 'kitty') {
      if (command.f === 100 || command.f === undefined) {
        // Use the WebView's normal <img> compositor for PNG. On affected
        // Windows WebView2 versions, createImageBitmap can decode successfully
        // yet draw an opaque black canvas. Calling Image.decode() on a detached
        // element is also rejected on some WebView2 builds even for a complete
        // PNG. Validate the bytes/header here, then let the actual connected
        // overlay <img> perform the one and only image decode.
        const { width, height } = pngDimensions(bytes);
        const imageUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
        return {
          width,
          height,
          imageUrl,
          close: () => URL.revokeObjectURL(imageUrl),
        };
      }
      const width = command.s;
      const height = command.v;
      const pixelCount = width * height;
      const expected = pixelCount * (command.f === 32 ? 4 : 3);
      if (bytes.byteLength !== expected) throw new Error('raw pixel payload has an invalid length');
      if (command.f === 32) {
        // Keep direct RGBA frames as ImageData instead of round-tripping them
        // through createImageBitmap.  WebView2 can successfully construct the
        // ImageBitmap yet paint it as an opaque black canvas on Windows.  A
        // canvas putImageData call is the native raw-pixel presentation path
        // and is also independent of the browser's image decoder.
        return {
          width,
          height,
          imageData: new ImageData(new Uint8ClampedArray(bytes), width, height),
          // fpasobrowser's Windows bridge always makes its screenshot opaque.
          // Requesting an opaque 2D backing store avoids WebView2's
          // transparent-overlay compositor path, which can show the whole
          // otherwise valid raw canvas as black. Generic Kitty RGBA keeps
          // alpha support on the normal path.
          opaqueCanvas: transport === 'fpasoterm-osc',
          close() {},
        };
      }
      const rgba = new Uint8ClampedArray(pixelCount * 4);
      for (let source = 0, target = 0; source < bytes.length; source += 3, target += 4) {
        rgba[target] = bytes[source];
        rgba[target + 1] = bytes[source + 1];
        rgba[target + 2] = bytes[source + 2];
        rgba[target + 3] = 255;
      }
      return {
        width,
        height,
        imageData: new ImageData(rgba, width, height),
        close() {},
      };
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

    _createPlacement(imageId, command, anchor = this._captureAnchor()) {
      const bitmap = this.images.get(imageId);
      if (!bitmap || !this._ensureLayer()) return null;
      const placementId = this._placementIdFor(imageId, command);
      const existing = this.placements.get(placementId);
      // terminal-browser updates the same implicit image repeatedly. Reusing
      // its canvas keeps the previous frame visible until the new bitmap is
      // painted; removing and appending a canvas for every frame produces a
      // visible blank interval, especially through Herdr pass-through.
      const tagName = bitmap.imageUrl ? 'IMG' : 'CANVAS';
      let canvas = existing?.canvas;
      if (!canvas || canvas.tagName !== tagName) {
        canvas?.remove?.();
        canvas = document.createElement(tagName.toLowerCase());
        canvas.className = 'fpasoterm-kitty-placement';
        if (tagName === 'IMG') {
          canvas.alt = '';
          canvas.decoding = 'async';
          canvas.draggable = false;
          canvas.addEventListener('error', () => {
            this.onErrorDiagnostic(`fpasoterm graphics image element failed to decode id=${canvas.dataset.imageId || imageId}`);
          });
        }
        this.layer.appendChild(canvas);
      }
      canvas.dataset.imageId = String(imageId);
      const placement = {
        id: placementId,
        imageId,
        canvas,
        line: anchor.line,
        column: anchor.column,
        columns: command.c,
        rows: command.r,
        xOffset: command.X || 0,
        yOffset: command.Y || 0,
        zIndex: command.z || 0,
      };
      this.placements.set(placementId, placement);
      this._setActive(true);
      while (this.placements.size > this.limits.maxPlacements) {
        this._deletePlacement(this.placements.keys().next().value);
      }
      this._paintPlacement(placement);
      this._renderPlacements();
      return placementId;
    }

    _placementIdFor(imageId, command) {
      if (command.p) return command.p;
      for (const [placementId, placement] of this.placements) {
        if (placement.imageId === imageId) return placementId;
      }
      return this.nextPlacementId++;
    }

    _placeStored(command) {
      const id = command.i;
      if (!id || !this.images.has(id)) throw new Error('unknown image id');
      const placementId = this._createPlacement(id, command);
      this._flushDeleteSnapshots(this.deleteSequence, id, placementId);
      this._respond(command, 'OK', true);
    }

    _paintPlacement(placement) {
      const bitmap = this.images.get(placement.imageId);
      if (!bitmap) return;
      if (bitmap.imageUrl) {
        if (placement.canvas.src !== bitmap.imageUrl) placement.canvas.src = bitmap.imageUrl;
        return;
      }
      placement.canvas.width = bitmap.width;
      placement.canvas.height = bitmap.height;
      const context = placement.canvas.getContext('2d', bitmap.opaqueCanvas
        ? { alpha: false, willReadFrequently: true }
        : { alpha: true });
      if (!context) throw new Error('2D canvas context is unavailable');
      context.clearRect(0, 0, bitmap.width, bitmap.height);
      if (bitmap.imageData) {
        if (typeof context.putImageData !== 'function') {
          throw new Error('2D canvas putImageData is unavailable');
        }
        context.putImageData(bitmap.imageData, 0, 0);
      } else {
        context.drawImage(bitmap, 0, 0);
      }
    }

    _renderPlacements() {
      if (!this._ensureLayer()) return;
      const rect = this.terminal.element.querySelector('.xterm-screen')?.getBoundingClientRect();
      if (!rect || !this.terminal.cols || !this.terminal.rows) return;
      const cellWidth = rect.width / this.terminal.cols;
      const cellHeight = rect.height / this.terminal.rows;
      const viewportY = this.terminal.buffer.active.viewportY;
      for (const placement of this.placements.values()) {
        const row = placement.line - viewportY;
        placement.canvas.hidden = row < -this.terminal.rows || row >= this.terminal.rows;
        placement.canvas.style.left = `${placement.column * cellWidth + placement.xOffset}px`;
        placement.canvas.style.top = `${row * cellHeight + placement.yOffset}px`;
        placement.canvas.style.width = placement.columns ? `${placement.columns * cellWidth}px` : `${placement.canvas.width}px`;
        placement.canvas.style.height = placement.rows ? `${placement.rows * cellHeight}px` : `${placement.canvas.height}px`;
        placement.canvas.style.zIndex = String(Math.max(-1, Math.min(1, placement.zIndex)));
      }
    }

    _delete(command) {
      const selector = String(command.d || 'a');
      const normalizedSelector = selector.toLowerCase();
      if (!['a', 'i', 'p'].includes(normalizedSelector)) {
        throw new Error(`unsupported delete selector d=${selector}`);
      }
      if (normalizedSelector === 'i' && !command.i) {
        throw new Error('delete selector d=i requires an image id');
      }
      if (normalizedSelector === 'p'
          && (!(Number(command.x) > 0) || !(Number(command.y) > 0))) {
        throw new Error('delete selector d=p requires positive x and y cells');
      }
      if (this.pendingDeleteSequence !== null) {
        if (this.pendingDeleteTimer !== null) clearTimeout(this.pendingDeleteTimer);
        this.pendingDeleteTimer = null;
        const previousSequence = this.pendingDeleteSequence;
        this.pendingDeleteSequence = null;
        this._flushDeleteSnapshots(previousSequence);
      }
      const sequence = ++this.deleteSequence;
      if (normalizedSelector === 'i' && !command.p) {
        this.imageDeleteSequences.set(command.i, sequence);
      } else if (normalizedSelector === 'a') {
        // A decode may still be awaiting inflate/createImageBitmap and is not
        // represented by the placement snapshot below. Record the deletion
        // sequence as a barrier so that such a job cannot resurrect an image.
        this.deleteAllSequence = sequence;
        this.imageDeleteSequences.clear();
      }
      this._pruneImageDeleteSequences();
      this.deleteSnapshots.set(sequence, this._snapshotDelete(command));
      this.pendingDeleteSequence = sequence;
      // Herdr can forward a delete and its replacement frame as separate PTY
      // writes. Keep the previous frame until its replacement has actually
      // painted, then remove only the placements that existed at delete time.
      // This avoids both a blank flash and multiple full-screen frames stacking.
      this.pendingDeleteTimer = setTimeout(() => {
        this.pendingDeleteTimer = null;
        if (this.pendingDeleteSequence === sequence) this.pendingDeleteSequence = null;
        this._flushDeleteSnapshots(sequence);
      }, 750);
      this._respond(command, 'OK', true);
    }

    _snapshotDelete(command) {
      const rawSelector = String(command.d || 'a');
      const selector = rawSelector.toLowerCase();
      const selectedPlacementIds = (predicate) => new Set(Array.from(this.placements)
        .filter(([, placement]) => predicate(placement))
        .map(([placementId]) => placementId));
      const imagesFullyRemovedBy = (placementIds) => {
        const imageIds = new Set();
        for (const [imageId] of this.images) {
          const placements = Array.from(this.placements)
            .filter(([, placement]) => placement.imageId === imageId)
            .map(([placementId]) => placementId);
          if (placements.length === 0 || placements.every((placementId) => placementIds.has(placementId))) {
            imageIds.add(imageId);
          }
        }
        return imageIds;
      };
      if (selector === 'p') {
        const x = Number(command.x);
        const y = Number(command.y);
        const placementIds = selectedPlacementIds((placement) => {
            const left = placement.column + 1;
            const top = placement.line - (this.terminal?.buffer?.active?.viewportY || 0) + 1;
            const width = Math.max(1, Number(placement.columns) || 1);
            const height = Math.max(1, Number(placement.rows) || 1);
            return x >= left && x < left + width && y >= top && y < top + height;
          });
        const imageIds = rawSelector === 'P' ? imagesFullyRemovedBy(placementIds) : new Set();
        return { imageIds, placementIds };
      }
      if (selector === 'i' && command.i && command.p) {
        const placement = this.placements.get(command.p);
        const placementIds = new Set(placement?.imageId === command.i ? [command.p] : []);
        return {
          imageIds: rawSelector === 'I' ? imagesFullyRemovedBy(placementIds) : new Set(),
          placementIds,
        };
      }
      if (selector === 'i' && command.i) {
        const placementIds = selectedPlacementIds((placement) => placement.imageId === command.i);
        return {
          imageIds: rawSelector === 'I' && this.images.has(command.i)
            ? new Set([command.i])
            : new Set(),
          placementIds,
        };
      }
      const viewportY = this.terminal?.buffer?.active?.viewportY || 0;
      const terminalRows = Math.max(0, Number(this.terminal?.rows) || 0);
      const placementIds = selectedPlacementIds((placement) => {
        const top = placement.line - viewportY;
        const height = Math.max(1, Number(placement.rows) || 1);
        return terminalRows > 0 && top < terminalRows && top + height > 0;
      });
      return {
        imageIds: rawSelector === 'A' ? imagesFullyRemovedBy(placementIds) : new Set(),
        placementIds,
      };
    }

    _flushDeleteSnapshots(through, protectedImageId = null, protectedPlacementId = null) {
      if (!through) return;
      for (const [sequence, snapshot] of Array.from(this.deleteSnapshots)) {
        if (sequence > through) continue;
        for (const imageId of snapshot.imageIds) {
          if (imageId !== protectedImageId) this._deleteImage(imageId);
        }
        for (const placementId of snapshot.placementIds) {
          if (placementId !== protectedPlacementId) this._deletePlacement(placementId);
        }
        this.deleteSnapshots.delete(sequence);
      }
    }

    _clearPendingDeletes() {
      if (this.pendingDeleteTimer !== null) clearTimeout(this.pendingDeleteTimer);
      this.pendingDeleteTimer = null;
      this.pendingDeleteSequence = null;
      this.deleteSnapshots.clear();
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
      placement.canvas?.remove?.();
      this.placements.delete(id);
      if (this.placements.size === 0) this._setActive(false);
    }

    _setActive(active) {
      const next = Boolean(active);
      if (this.active === next) return;
      this.active = next;
      this.onActiveChange(next);
    }

    _respond(command, message, success) {
      const quiet = command?.q || 0;
      if ((success && quiet >= 1) || (!success && quiet >= 2)) return;
      const id = command?.i ? `i=${command.i};` : '';
      this.terminal?.input?.(`\x1b_G${id}${message}\x1b\\`, false);
    }

    reset() {
      // Invalidate a decode that is already awaiting inflate/createImageBitmap.
      // Its completion belongs to the previous full-screen application and
      // must not draw or send a Kitty response into the restored shell.
      this.generation += 1;
      this._clearPendingDeletes();
      this.deleteAllSequence = this.deleteSequence;
      this.imageDeleteSequences.clear();
      this.queue.clear();
      this.chunks = null;
      for (const id of Array.from(this.placements.keys())) this._deletePlacement(id);
      for (const bitmap of this.images.values()) bitmap.close?.();
      this.images.clear();
      this._setActive(false);
    }

    dispose() {
      this.reset();
      for (const disposable of this.disposables.splice(0)) disposable?.dispose?.();
      this.layer?.remove?.();
      this.layer = null;
    }
  }

  return {
    DEFAULT_LIMITS,
    KittyGraphicsAddon,
    LatestJobQueue,
    describePngBytes,
    parseKittyControl,
    pngDimensions,
    validateKittyCommand,
  };
}));
