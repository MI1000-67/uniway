import type { Campus, MapImage } from '../data';

function analyzeInWorker(input: Record<string, unknown>, signal: AbortSignal): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
    const stop = () => {
      worker.terminate();
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      stop();
      reject(new DOMException('Import cancelled', 'AbortError'));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      stop();
      data.error ? reject(new Error(data.error)) : resolve(data.result);
    };
    worker.onerror = () => {
      stop();
      reject(new Error('The map analysis worker could not start. Please try another browser.'));
    };
    worker.postMessage(input);
  });
}

export async function importImages(
  files: File[],
  signal: AbortSignal,
  progress: (text: string) => void,
): Promise<Campus> {
  if (!files.length) throw new Error('Choose at least one map image.');
  if (files.length > 8) throw new Error('Choose up to eight map images.');
  for (const f of files) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type))
      throw new Error('Choose JPG, PNG, or WebP map images.');
    if (f.size > 15_000_000) throw new Error('Each image must be smaller than 15 MB.');
  }
  progress('Loading on-device AI…');
  const { createWorker, PSM } = await import('tesseract.js');
  if (signal.aborted) throw new DOMException('Import cancelled', 'AbortError');
  const worker = await createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/core',
    langPath: '/ocr/lang',
    cacheMethod: 'none',
    workerBlobURL: false,
    logger: (message) => {
      if (message.status === 'recognizing text')
        progress(`Reading place labels · ${Math.round(message.progress * 100)}%`);
    },
  });
  const abort = () => {
    void worker.terminate();
  };
  signal.addEventListener('abort', abort, { once: true });
  const campus: Campus = {
    version: 1,
    name: files[0].name.replace(/\.[^.]+$/, ''),
    places: [],
    edges: [],
    junctions: [],
    images: [],
  };
  try {
    if (signal.aborted) throw new DOMException('Import cancelled', 'AbortError');
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    for (let floor = 0; floor < files.length; floor++) {
      if (signal.aborted) throw new DOMException('Import cancelled', 'AbortError');
      progress(`Reading image ${floor + 1} of ${files.length}…`);
      const bitmap = await createImageBitmap(files[floor]);
      if (bitmap.width * bitmap.height > 40_000_000) {
        bitmap.close();
        throw new Error('This image is too large to process. Resize it below 40 megapixels.');
      }
      const factor = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * factor);
      canvas.height = Math.round(bitmap.height * factor);
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const data = canvas.toDataURL('image/jpeg', 0.94);
      const ocr = document.createElement('canvas');
      const readingScale = Math.min(3, 2400 / Math.max(canvas.width, canvas.height));
      ocr.width = Math.round(canvas.width * readingScale);
      ocr.height = Math.round(canvas.height * readingScale);
      const reading = ocr.getContext('2d')!;
      reading.imageSmoothingEnabled = true;
      reading.imageSmoothingQuality = 'high';
      reading.drawImage(canvas, 0, 0, ocr.width, ocr.height);
      const result = await worker.recognize(ocr, {}, { blocks: true });
      const rasterScale = Math.min(1, 640 / canvas.width, 640 / canvas.height);
      const width = Math.max(10, Math.round(canvas.width * rasterScale)),
        height = Math.max(10, Math.round(canvas.height * rasterScale));
      const small = document.createElement('canvas');
      small.width = width;
      small.height = height;
      const c = small.getContext('2d')!;
      c.drawImage(canvas, 0, 0, width, height);
      const ratioX = width / ocr.width,
        ratioY = height / ocr.height;
      const lines = (result.data.blocks ?? [])
        .flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines))
        .map((line) => ({
          text: line.text,
          confidence: line.confidence,
          x: line.bbox.x0 * ratioX,
          y: line.bbox.y0 * ratioY,
          width: (line.bbox.x1 - line.bbox.x0) * ratioX,
          height: (line.bbox.y1 - line.bbox.y0) * ratioY,
        }));
      progress('Turning the layout into an interactive map…');
      const generated = await analyzeInWorker(
        { pixels: c.getImageData(0, 0, width, height).data, width, height, lines, floor },
        signal,
      );
      if (signal.aborted) throw new DOMException('Import cancelled', 'AbortError');
      if (floor === 0 && generated.title) campus.name = generated.title;
      campus.places.push(...generated.places);
      campus.edges.push(...generated.edges);
      campus.junctions!.push(...generated.junctions);
      campus.images.push({
        name: files[floor].name.replace(/\.[^.]+$/, ''),
        data,
        buildings: generated.buildings,
        roads: generated.roads,
        warnings: generated.warnings,
        unplacedLabels: generated.unplacedLabels,
        reviewed: false,
      } as MapImage);
    }
    return campus;
  } finally {
    signal.removeEventListener('abort', abort);
    await worker.terminate();
  }
}
