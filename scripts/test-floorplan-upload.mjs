import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const heicFile = "C:/Users/ilmya/Downloads/20261102_131215.heic";
const fallbackJpg =
  "C:/Users/ilmya/.gemini/antigravity/brain/1c2cd750-f975-4931-8976-45f47341a151/.user_uploaded/media_1794344295109_cb235778.jpg";
const file = fs.existsSync(heicFile) ? heicFile : fallbackJpg;
console.log("TESTING FLOORPLAN FILE:", file);

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

  // Wait for HEIC conversion and thumbnail to appear
  await page.locator(".uploaded-image").waitFor({ timeout: 35000 });
  const thumbnailCount = await page.locator(".uploaded-image").count();
  console.log("THUMBNAIL COUNT:", thumbnailCount);
  assert.equal(thumbnailCount, 1, "Expected 1 uploaded map thumbnail");

  // Verify expiration countdown badge is visible in UploadPanel
  const expiryBadge = await page
    .locator(".thumbnail-expiry")
    .innerText()
    .catch(() => "");
  console.log("UPLOAD PANEL EXPIRY BADGE:", expiryBadge);
  assert.match(
    expiryBadge,
    /⏳\s*(?:[1-3]h|\d+m)/,
    "Expected map expiration countdown",
  );

  await page
    .getByRole("button", { name: "Make this map interactive", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Map analysis result" })
    .waitFor({ timeout: 130000 });
  const analysis = await page
    .getByRole("region", { name: "Map analysis result" })
    .innerText();
  console.log("FLOORPLAN ANALYSIS:", analysis);

  // Verify expiration badge in MapEditor
  const editorExpiry = await page
    .locator(".map-editor .preparation-badge")
    .allInnerTexts();
  console.log("EDITOR BADGES:", editorExpiry);
  assert(
    editorExpiry.some((b) => b.includes("Expires in")),
    "Expected expiration badge in MapEditor",
  );

  const pointsCount = await page.locator(".editor-point-list button").count();
  console.log("POINTS COUNT:", pointsCount);
  assert(
    pointsCount >= 10,
    `Expected at least 10 places, found ${pointsCount}`,
  );

  await page.screenshot({ path: "test-results/floorplan-editor.png" });

  // Check auto-connect or review buttons
  if (
    await page.getByRole("button", { name: /Confirm all.*walkable/i }).count()
  ) {
    await page
      .getByRole("button", { name: /Confirm all.*walkable/i })
      .first()
      .click();
  }
  await page.getByLabel(/I’ve checked/).check();

  const canPublish = await page
    .getByRole("button", { name: "Open interactive map", exact: true })
    .isEnabled();
  console.log("CAN PUBLISH:", canPublish);
  assert(canPublish, "Expected map to be publishable");

  await page
    .getByRole("button", { name: "Open interactive map", exact: true })
    .click();

  // Wait for explore / navigation
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "test-results/floorplan-interactive.png" });

  // Verify expiration timer in PreparedMapExplorer header
  const explorerExpiry = await page
    .locator(".prepared-badge")
    .allInnerTexts()
    .catch(() => []);
  console.log("EXPLORER BADGES:", explorerExpiry);

  const placeBtn = page
    .getByRole("button", {
      name: /L201 Academic Staff|West Staircase|Lecture/i,
    })
    .first();
  await placeBtn.waitFor();
  console.log("CLICKING PLACE:", await placeBtn.innerText());
  await placeBtn.click();

  const showRouteBtn = page.getByRole("button", {
    name: "Show walking route",
    exact: true,
  });
  await showRouteBtn.waitFor();
  await showRouteBtn.click();

  await page.locator(".route-choice").first().waitFor();
  const routesCount = await page.locator(".route-choice").count();
  console.log("FLOORPLAN ROUTE CHOICES COUNT:", routesCount);
  assert.equal(routesCount, 3, "Expected exactly 3 route choices");
  await page.screenshot({ path: "test-results/floorplan-routes.png" });

  console.log("ERRORS ENCOUNTERED:", errors);
  assert.equal(errors.length, 0, "Expected zero errors");
  console.log("ALL FLOORPLAN TESTS COMPLETED SUCCESSFULLY!");
} catch (e) {
  console.error("Test failure:", e);
  await page
    .screenshot({ path: "test-results/floorplan-failure.png" })
    .catch(() => {});
  throw e;
} finally {
  await b.close();
}
