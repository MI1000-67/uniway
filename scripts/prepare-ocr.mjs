import { mkdir, cp, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'),
  target = resolve(root, 'public/ocr');
await mkdir(resolve(target, 'core'), { recursive: true });
await mkdir(resolve(target, 'lang'), { recursive: true });
await cp(
  resolve(root, 'node_modules/tesseract.js/dist/worker.min.js'),
  resolve(target, 'worker.min.js'),
);
const core = resolve(root, 'node_modules/tesseract.js-core');
for (const file of await readdir(core))
  if (/\.wasm(?:\.js)?$/.test(file)) await cp(resolve(core, file), resolve(target, 'core', file));
await cp(
  resolve(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),
  resolve(target, 'lang/eng.traineddata.gz'),
);
console.log('Local OCR worker, WebAssembly builds, and English model are ready.');

await mkdir(resolve(target, 'licenses'), { recursive: true });
await cp(
  resolve(root, 'node_modules/tesseract.js/LICENSE.md'),
  resolve(target, 'licenses/tesseract.js-LICENSE.md'),
);
await cp(resolve(core, 'LICENSE'), resolve(target, 'licenses/tesseract.js-core-LICENSE'));
await cp(
  resolve(root, 'node_modules/@tesseract.js-data/eng/package.json'),
  resolve(target, 'licenses/eng-package.json'),
);
await writeFile(
  resolve(target, 'licenses/README.txt'),
  'OCR runtime: Apache-2.0. English data npm package: MIT metadata; upstream trained data: https://github.com/naptha/tessdata . Preserve upstream notices when redistributing.',
);
