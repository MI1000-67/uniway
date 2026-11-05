import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

export const assetRoot = new URL("../public/ocr/", import.meta.url);
export const expected = JSON.parse(
  await readFile(new URL("./ocr-assets.json", import.meta.url), "utf8"),
);
export const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export const trainedLicense = {
  source:
    "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/LICENSE",
  sha256: "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
};

export async function runtimeFiles() {
  const runtime = new URL("../node_modules/tesseract.js/", import.meta.url);
  const core = new URL("../node_modules/tesseract.js-core/", import.meta.url);
  const pairs = [
    [new URL("dist/worker.min.js", runtime), "worker.min.js"],
    [new URL("LICENSE.md", runtime), "TESSERACT-JS-LICENSE.md"],
    [new URL("LICENSE", core), "TESSERACT-CORE-LICENSE"],
  ];
  for (const name of await readdir(core))
    if (/^tesseract-core.*\.(js|wasm)$/.test(name))
      pairs.push([new URL(name, core), `core/${name}`]);
  return pairs;
}

export async function installedRuntime() {
  const pkg = JSON.parse(
    await readFile(
      new URL("../node_modules/tesseract.js/package.json", import.meta.url),
      "utf8",
    ),
  );
  return `tesseract.js ${pkg.version}`;
}
