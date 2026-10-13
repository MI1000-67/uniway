import assert from 'node:assert/strict';
import { createWorker, PSM } from 'tesseract.js';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const worker = await createWorker('eng', 1, {
  langPath: resolve(root, 'public/ocr/lang'),
  cacheMethod: 'none',
  logger: () => {},
});
try {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  const { data } = await worker.recognize(
    resolve(root, 'tests/fixtures/ocr-labels.png'),
    {},
    { blocks: true },
  );
  assert.match(data.text, /Central Library/i);
  assert.match(data.text, /Student Centre/i);
  assert.ok(data.blocks?.length, 'OCR must return geometry for the importer');
  console.log('Local English OCR recognized both fixture labels with geometry.');
} finally {
  await worker.terminate();
}
