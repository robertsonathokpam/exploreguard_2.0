// Model identifiers and thresholds configure inference; no detection result is synthesized.
// RT-DETR model card: https://huggingface.co/onnx-community/rtdetr_r18vd
export async function createPersonDetector(choice, dependencies = {}) {
  if (choice === 'mobilenet') {
    const coco = dependencies.cocoSsd || globalThis.cocoSsd;
    if (!coco) throw new Error('TensorFlow COCO-SSD library unavailable');
    return coco.load({base: 'mobilenet_v2'});
  }
  if (choice !== 'rtdetr') throw new Error('Unsupported model');
  const load = dependencies.loadTransformers || (() => import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js'));
  const {pipeline, RawImage, env} = await load();
  env.allowLocalModels = false;
  // Single-thread WASM also works on static hosts without cross-origin isolation headers.
  env.backends.onnx.wasm.numThreads = 1;
  const detector = await pipeline('object-detection', 'onnx-community/rtdetr_r18vd', {
    device: 'wasm', dtype: 'q8'
  });
  return {
    async detect(canvas, maxBoxes, threshold) {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const image = new RawImage(pixels.data, canvas.width, canvas.height, 4);
      const detections = await detector(image, {threshold, percentage: false});
      return detections.filter(item => item.label === 'person').slice(0, maxBoxes).map(item => ({
        class: item.label, score: item.score,
        bbox: [item.box.xmin, item.box.ymin, item.box.xmax-item.box.xmin, item.box.ymax-item.box.ymin]
      }));
    }
  };
}
