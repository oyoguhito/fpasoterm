/// <reference path="../../docs/fpasoterm-plugin.d.ts" />
// @fpasoterm-plugin version: 1.0.0
// @fpasoterm-plugin description: Demonstrates explicit local asset selection in a fpasoterm canvas modal.

const api = window.fpasotermPluginApi;

function drawMessage(canvas: HTMLCanvasElement, message: string) {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = '#101820';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#d8e7f5';
  context.font = '18px ui-monospace, monospace';
  context.textAlign = 'center';
  context.fillText(message, canvas.width / 2, canvas.height / 2);
}

api.registerCommand('local-asset-canvas', 'Preview local image', () => {
  const overlay = api.openCanvasOverlay({
    title: 'Local image preview',
    width: 960,
    height: 600,
  });
  const { canvas } = overlay;
  let selecting = false;
  drawMessage(canvas, 'Click, Enter, or Space to choose an image. Escape closes.');

  const chooseImage = async () => {
    if (selecting) return;
    selecting = true;
    try {
      const asset = await api.selectLocalAsset({
        accept: ['image/*'],
        maxBytes: 16 * 1024 * 1024,
      });
      if (!asset) {
        drawMessage(canvas, 'No image selected. Click, Enter, or Space to try again.');
        return;
      }
      const url = URL.createObjectURL(new Blob([asset.bytes], { type: asset.mediaType }));
      const image = new Image();
      image.onload = () => {
        const context = canvas.getContext('2d');
        if (!context) return;
        const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
        const width = Math.max(1, Math.floor(image.naturalWidth * scale));
        const height = Math.max(1, Math.floor(image.naturalHeight * scale));
        context.fillStyle = '#101820';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        URL.revokeObjectURL(url);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        drawMessage(canvas, `Could not decode ${asset.name}.`);
      };
      image.src = url;
    } catch (error) {
      drawMessage(canvas, `Could not read image: ${String(error)}`);
      api.log(`local-asset-canvas failed: ${String(error)}`);
    } finally {
      selecting = false;
    }
  };
  canvas.addEventListener('click', chooseImage);
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void chooseImage();
    }
  });
});
