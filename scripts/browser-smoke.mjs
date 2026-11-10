import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
if (!process.argv[2])
  throw new Error("Pass the Science Faculty map image path.");
const b = await chromium.launch({ headless: true, channel: "msedge" });
const page = await b.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:5173"))
    external.push(r.url());
});
try {
  await page.goto("http://127.0.0.1:5173");
  await page
    .getByRole("button", { name: /Central Library.*Study spaces/ })
    .click();
  await page
    .getByRole("button", { name: "Get directions", exact: true })
    .click();
  assert.equal(await page.locator(".route-choice").count(), 3);
  await page.getByRole("button", { name: /Alternative 2.*Dotted/ }).click();
  assert.equal(
    await page.locator(".route-choice[aria-pressed=true] strong").textContent(),
    "Alternative 2",
  );
  await page.getByRole("button", { name: "Map compass and rotation" }).click();
  await page.getByRole("button", { name: "Rotate map right" }).click();
  assert.equal(
    await page.locator("[data-map-rotation]").getAttribute("data-map-rotation"),
    "30",
  );
  await page.getByRole("button", { name: "North up", exact: true }).click();
  await page.getByRole("button", { name: "Close compass controls" }).click();
  await page.screenshot({ path: "test-results/routes-desktop.png" });
  await page.getByRole("button", { name: /Upload a map/ }).click();
  await page
    .getByLabel("Choose campus map images")
    .setInputFiles(process.argv[2]);
  await page
    .getByRole("button", { name: "Make this map interactive", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Map analysis result" })
    .waitFor({ timeout: 130000 });
  const analysis = await page
    .getByRole("region", { name: "Map analysis result" })
    .innerText();
  console.log("SCIENCE ANALYSIS", analysis);
  await page.screenshot({ path: "test-results/science-analysis.png" });
  console.log(
    "POINTS",
    await page.locator(".editor-point-list button").count(),
  );
  await page
    .getByRole("button", { name: "Open map preview", exact: true })
    .click();
  await page.getByRole("heading", { name: /Science Faculty/ }).waitFor();
  await page.screenshot({ path: "test-results/science-preview.png" });
  await page
    .getByRole("button", {
      name: "Select Information & Learning Centre",
      exact: true,
    })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Show walking route", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Edit this map" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Map rotation; north not calibrated" })
    .click();
  await page
    .getByRole("button", { name: "Use this as north", exact: true })
    .click();
  await page.getByRole("button", { name: "Close compass controls" }).click();
  if (
    await page.getByRole("button", { name: /Confirm all.*walkable/i }).count()
  ) {
    await page
      .getByRole("button", { name: /Confirm all.*walkable/i })
      .first()
      .click();
  }
  await page.getByLabel(/I’ve checked/).check();
  console.log(
    "CAN PUBLISH",
    await page
      .getByRole("button", { name: "Open interactive map", exact: true })
      .isEnabled(),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Open interactive map", exact: true })
      .isEnabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Open interactive map", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Select Information & Learning Centre",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Show walking route", exact: true })
    .click();
  await page.locator(".route-choice").first().waitFor();
  console.log(
    "SCIENCE ROUTE CHOICES",
    await page.locator(".route-choice").count(),
  );
  assert.ok((await page.locator(".route-choice").count()) >= 1);
  await page.screenshot({ path: "test-results/science-routes.png" });
  await page
    .getByRole("button", { name: "Switch to night mode", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.getByRole("button", { name: "Dismiss notification" }).isVisible()
  )
    await page.getByRole("button", { name: "Dismiss notification" }).click();
  await page.getByRole("button", { name: "Fit uploaded route" }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: "test-results/mobile-night.png" });
  await writeFile(
    "test-results/browser-results.json",
    JSON.stringify({ analysis, errors, external }, null, 2),
  );
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
} catch (e) {
  console.error(e.message);
  console.log("ERRORS", errors);
  await page.screenshot({ path: "test-results/browser-failure.png" });
  await writeFile(
    "test-results/browser-failure.txt",
    await page.locator("body").innerText(),
  );
  throw e;
} finally {
  await b.close();
}
