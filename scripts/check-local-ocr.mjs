import { readFile } from "node:fs/promises";
import {
  assetRoot,
  expected,
  digest,
  trainedLicense,
  runtimeFiles,
  installedRuntime,
} from "./ocr-assets.mjs";

try {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", assetRoot), "utf8"),
  );
  if (manifest.runtime !== (await installedRuntime()))
    throw new Error("OCR runtime version is out of date.");
  for (const record of expected.languages) {
    const entry = manifest.languages.find(
      (item) => item.language === record.language,
    );
    if (
      !entry ||
      entry.sha256 !== record.sha256 ||
      entry.bytes !== record.bytes ||
      entry.source !== record.source
    )
      throw new Error(`Invalid provenance for ${record.language}.`);
    const data = await readFile(
      new URL(`lang/${record.language}.traineddata`, assetRoot),
    );
    if (data.length !== record.bytes || digest(data) !== record.sha256)
      throw new Error(`Corrupt language asset: ${record.language}.`);
  }
  const files = await runtimeFiles();
  for (const [source, target] of files) {
    const installed = await readFile(source),
      copied = await readFile(new URL(target, assetRoot));
    if (digest(installed) !== digest(copied))
      throw new Error(
        `Runtime asset differs from the installed package: ${target}.`,
      );
  }
  if (
    digest(await readFile(new URL("TESSDATA-LICENSE", assetRoot))) !==
    trainedLicense.sha256
  )
    throw new Error("Trained-data license is missing or changed.");
  console.log(
    `OCR integrity passed offline: ${expected.languages.length} languages, ${files.length} runtime/license files, trained-data license.`,
  );
} catch (error) {
  console.error(
    `Local OCR check failed: ${error.message}\nRun npm run engine:setup from the project root, then retry. No maps are needed or uploaded.`,
  );
  process.exitCode = 1;
}
