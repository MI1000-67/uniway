import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
if (!process.argv[2]) throw new Error("Pass the faint floor-plan photo.");
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const external = [],
  errors = [];
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:5173"))
    external.push(r.url());
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: /Upload a map/ }).click();
  await page
    .getByLabel("Choose campus map images")
    .setInputFiles(process.argv[2]);
  await page.getByLabel("Layout text language").waitFor();
  assert.equal(
    await page.getByLabel("Layout text language").locator("option").count(),
    8,
  );
  await page
    .getByRole("button", { name: "Make this map interactive", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Map analysis result" })
    .waitFor({ timeout: 130000 });
  assert.match(
    await page.getByRole("region", { name: "Map analysis result" }).innerText(),
    /faint/,
  );
  assert.equal(await page.locator(".editor-point-list button").count(), 0);
  await page.screenshot({ path: "test-results/faint-map-mobile.png" });
  await page
    .getByRole("button", { name: "Open map preview", exact: true })
    .click();
  await page.locator(".draft-notice").waitFor();
  assert.equal(await page.locator(".draft-notice").isVisible(), true);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/faint-validation.json",
    JSON.stringify(
      {
        quality: "limited",
        places: 0,
        paths: 0,
        preview: true,
        external,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Faint image: quality note, no fabricated paths, usable preview, 8 languages, no external requests.",
  );
} finally {
  await browser.close();
}
