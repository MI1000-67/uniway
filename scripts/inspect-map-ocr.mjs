import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
const file = process.argv[2];
if (!file) throw new Error("Pass a local image path");
const worker = await createWorker("eng", 1, {
  langPath: new URL("../public/ocr/lang", import.meta.url).pathname.replace(
    /^\/([A-Z]:)/i,
    "$1",
  ),
  gzip: false,
  cacheMethod: "none",
});
const meta = await sharp(file).metadata();
await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
const image = await sharp(file)
  .flatten({ background: "white" })
  .resize({ width: meta.width * 2 })
  .png()
  .toBuffer();
const { data } = await worker.recognize(
  image,
  {},
  { text: true, blocks: true },
);
await mkdir("test-results/engine", { recursive: true });
await writeFile(
  "test-results/engine/raw-ocr.json",
  JSON.stringify(data, null, 2),
);
console.log(data.text);
await worker.terminate();
