// Development setup only. Map processing never contacts these download endpoints.
import { mkdir, copyFile, readFile, writeFile, rename } from "node:fs/promises";
import {
  assetRoot,
  expected,
  digest,
  trainedLicense,
  runtimeFiles,
  installedRuntime,
} from "./ocr-assets.mjs";

await mkdir(new URL("core/", assetRoot), { recursive: true });
await mkdir(new URL("lang/", assetRoot), { recursive: true });
for (const [source, target] of await runtimeFiles())
  await copyFile(source, new URL(target, assetRoot));

async function provision(path, record) {
  const target = new URL(path, assetRoot);
  try {
    const cached = await readFile(target);
    if (
      digest(cached) === record.sha256 &&
      (!record.bytes || cached.length === record.bytes)
    )
      return;
  } catch {
    /* Missing assets are downloaded only by this explicit setup command. */
  }
  const response = await fetch(record.source, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok)
    throw new Error(`Could not download ${path}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (
    digest(data) !== record.sha256 ||
    (record.bytes && data.length !== record.bytes)
  )
    throw new Error(
      `Integrity check failed for ${path}; the existing asset was not replaced.`,
    );
  const temporary = new URL(`${path}.part`, assetRoot);
  await writeFile(temporary, data);
  await rename(temporary, target);
}

for (const record of expected.languages) {
  await provision(`lang/${record.language}.traineddata`, record);
  console.log(`Verified local language: ${record.language}`);
}
await provision("TESSDATA-LICENSE", trainedLicense);
await writeFile(
  new URL("manifest.json", assetRoot),
  JSON.stringify(
    { runtime: await installedRuntime(), languages: expected.languages },
    null,
    2,
  ),
);
console.log(
  "Local OCR assets ready. Run npm run engine:check to verify them offline.",
);
