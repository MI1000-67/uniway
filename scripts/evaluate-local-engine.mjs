import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
if (!process.argv[2])
  throw new Error(
    "Pass a layout image and optionally a faint-photo path. Requires the Vite development server.",
  );
const b = await chromium.launch({ headless: true, channel: "msedge" });
try {
  for (const [name, file] of [
    ["science", process.argv[2]],
    ["faint", process.argv[3]],
  ].filter(([, file]) => file)) {
    const page = await b.newPage();
    await page.goto("http://127.0.0.1:5173");
    await page.getByRole("button", { name: /Upload a map/ }).click();
    await page.getByLabel("Choose campus map images").setInputFiles(file);
    const img = page.locator(".image-viewer img");
    await img.waitFor();
    const url = await img.getAttribute("src");
    const map = await page.evaluate(
      async ({ url, name }) => {
        const { analyzeUploadedMap } = await import("/src/engine/index.ts");
        const image = new Image();
        image.src = url;
        await image.decode();
        return analyzeUploadedMap(
          {
            url,
            id: name,
            name,
            width: image.naturalWidth,
            height: image.naturalHeight,
          },
          "eng",
          () => {},
        );
      },
      { url, name },
    );
    await writeFile(
      `test-results/engine/${name}-browser.json`,
      JSON.stringify(map, null, 2),
    );
    console.log(
      name,
      JSON.stringify({
        analysis: map.analysis,
        nodes: map.nodes.length,
        edges: map.edges.length,
      }),
    );
    await page.close();
  }
} finally {
  await b.close();
}
