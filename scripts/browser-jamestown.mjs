import { chromium } from "playwright";
import assert from "node:assert/strict";

const file = process.argv[2] || "C:/Users/ilmya/Downloads/Campus_Map-25.png";
const b = await chromium.launch({ headless: true, channel: "msedge" });
const page = await b.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

try {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: /Upload a map/ }).click();
  await page.getByLabel("Choose campus map images").setInputFiles(file);
  await page
    .getByRole("button", { name: "Make this map interactive", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Map analysis result" })
    .waitFor({ timeout: 130000 });
  const analysis = await page
    .getByRole("region", { name: "Map analysis result" })
    .innerText();
  console.log("JAMESTOWN ANALYSIS:", analysis);
  await page.screenshot({ path: "test-results/jamestown-analysis.png" });

  const pointsCount = await page.locator(".editor-point-list button").count();
  console.log("JAMESTOWN POINTS COUNT:", pointsCount);
  assert.ok(pointsCount >= 25, `Expected >= 25 points, got ${pointsCount}`);

  await page
    .getByRole("button", { name: "Open map preview", exact: true })
    .click();
  await page.getByRole("heading", { name: /Jamestown/i }).waitFor();
  await page.screenshot({ path: "test-results/jamestown-preview.png" });

  await page.getByRole("button", { name: "Edit this map" }).click();
  await page.getByLabel(/I’ve checked/).check();

  const canPublish = await page
    .getByRole("button", { name: "Open interactive map", exact: true })
    .isEnabled();
  console.log("CAN PUBLISH JAMESTOWN:", canPublish);
  assert.equal(canPublish, true);

  await page
    .getByRole("button", { name: "Open interactive map", exact: true })
    .click();

  // Find a landmark to navigate to
  const placeBtn = page
    .getByRole("button", { name: /Raugust Library|Allen Field|Kroeze/i })
    .first();
  await placeBtn.waitFor();
  await placeBtn.click();

  await page
    .getByRole("button", { name: "Show walking route", exact: true })
    .click();
  await page.locator(".route-choice").first().waitFor();
  const routesCount = await page.locator(".route-choice").count();
  console.log("JAMESTOWN ROUTE CHOICES:", routesCount);
  assert.ok(routesCount >= 1);

  await page.screenshot({ path: "test-results/jamestown-routes.png" });
  console.log("JAMESTOWN TEST PASSED!");
  assert.deepEqual(errors, []);
} catch (e) {
  console.error("Jamestown test failure:", e.message);
  console.log("Errors:", errors);
  await page
    .screenshot({ path: "test-results/jamestown-failure.png" })
    .catch(() => {});
  throw e;
} finally {
  await b.close();
}
