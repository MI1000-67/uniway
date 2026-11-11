import { chromium } from "playwright";
import fs from "node:fs";

const files = [
  "C:/Users/ilmya/Downloads/55999.heic",
  "C:/Users/ilmya/Downloads/56002.heic",
  "C:/Users/ilmya/Downloads/20261102_131215.heic",
];

const b = await chromium.launch({ headless: true, channel: "msedge" });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

try {
  await page.goto("http://127.0.0.1:5173");
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log("File does not exist:", file);
      continue;
    }
    console.log("\n========================================");
    console.log("TESTING FILE:", file, "size:", fs.statSync(file).size);
    await page.getByRole("button", { name: /Upload a map/ }).click();
    await page.getByLabel("Choose campus map images").setInputFiles(file);

    console.log("Waiting for thumbnail...");
    const start = Date.now();
    await page.locator(".uploaded-image").last().waitFor({ timeout: 60000 });
    console.log("Thumbnail loaded in", Date.now() - start, "ms");

    const expiryBadge = await page
      .locator(".thumbnail-expiry")
      .last()
      .innerText()
      .catch(() => "");
    console.log("UploadPanel Expiry Badge:", expiryBadge);

    // Click make interactive
    await page
      .getByRole("button", { name: "Make this map interactive", exact: true })
      .last()
      .click();
    console.log("Analyzing map...");
    await page
      .getByRole("region", { name: "Map analysis result" })
      .waitFor({ timeout: 180000 });
    const analysis = await page
      .getByRole("region", { name: "Map analysis result" })
      .innerText();
    console.log("Analysis result:\n", analysis);

    const pointsCount = await page.locator(".editor-point-list button").count();
    console.log("Points count:", pointsCount);

    const safeName = file.split(/[\\/]/).pop().replace(/\./g, "_");
    await page.screenshot({ path: `test-results/test-${safeName}-editor.png` });

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
    console.log("Can publish:", canPublish);

    await page
      .getByRole("button", { name: "Open interactive map", exact: true })
      .click();
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: `test-results/test-${safeName}-interactive.png`,
    });

    // Test a route
    const firstPlace = page.locator(".map-place-item").first();
    if (await firstPlace.count()) {
      await firstPlace.click();
      const showRoute = page.getByRole("button", {
        name: "Show walking route",
        exact: true,
      });
      if ((await showRoute.count()) && (await showRoute.isEnabled())) {
        await showRoute.click();
        await page
          .locator(".route-choice")
          .first()
          .waitFor({ timeout: 10000 })
          .catch(() => {});
        const routeCount = await page.locator(".route-choice").count();
        console.log("Route choices count:", routeCount);
        await page.screenshot({
          path: `test-results/test-${safeName}-route.png`,
        });
      }
    }

    // Go back to main for next file
    const backBtn = page.getByRole("button", { name: /Willowbrook demo/i });
    if (await backBtn.count()) {
      await backBtn.click();
    } else {
      await page.goto("http://127.0.0.1:5173");
    }
  }
} catch (e) {
  console.error("Test error:", e);
  await page
    .screenshot({ path: "test-results/test-error.png" })
    .catch(() => {});
} finally {
  console.log("Console errors:", errors);
  await b.close();
}
