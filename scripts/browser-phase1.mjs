import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import sharp from "sharp";

// Synthetic fixtures only. Works with a built preview or the deployed app.
const appUrl = new URL(process.argv[2] || "http://127.0.0.1:5173/");
if (!appUrl.pathname.endsWith("/")) appUrl.pathname += "/";
const origin = appUrl.origin;
if (
  appUrl.protocol !== "https:" &&
  !new Set(["127.0.0.1", "localhost"]).has(appUrl.hostname)
)
  throw new Error("Use HTTPS or a local preview.");
const output = "test-results/phase1";
await mkdir(output, { recursive: true });
const fixture =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700">
<rect width="1000" height="700" fill="white"/>
<text x="50" y="60" font-family="Arial" font-size="32">Synthetic Campus Map</text>
<path d="M160 300 H840" stroke="#b5b5b5" stroke-width="12"/>
<text x="85" y="265" font-family="Arial" font-size="26">Main Entrance</text>
<text x="760" y="265" font-family="Arial" font-size="26">Library</text>
</svg>`);
const png = await sharp(fixture).png().toBuffer();
const browser = await chromium.launch({
  channel: process.env.UNIWAY_BROWSER_CHANNEL || "msedge",
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const result = { checks: [], errors: [], externalRequests: [] };
page.on("pageerror", (e) => result.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") result.errors.push(m.text());
});
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== origin)
    result.externalRequests.push(r.url());
});
const done = (name) => {
  result.checks.push(name);
  console.log("PASS", name);
};
const connect = () =>
  page
    .locator(".header-nav-switcher")
    .getByRole("button", { name: "UniWay Connect", exact: true })
    .click();
try {
  await page.goto(appUrl.href);
  await connect();
  assert.equal(new URL(page.url()).pathname, appUrl.pathname);
  assert.equal(new URL(page.url()).hash, "#/connect");
  await page.reload();
  await page
    .getByRole("heading", { name: "Find your way. Find your community." })
    .waitFor();
  done("Connect survives refresh inside the deployment subpath");
  await page
    .locator(".connect-card")
    .first()
    .getByRole("button", { name: "Navigate", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "School of Science", exact: true })
    .waitFor();
  await connect();
  await page.getByRole("button", { name: /^Volunteer/ }).click();
  await page
    .locator(".connect-card")
    .first()
    .getByRole("button", { name: "Directions", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "End directions", exact: true })
      .count(),
    0,
  );
  await page
    .getByText(/No verified route is available for University Sports Ground/)
    .waitFor();
  done("Unavailable sports destination clears previous directions");

  await page.getByRole("button", { name: "Upload a map", exact: true }).click();
  await page.getByLabel("Choose campus map images").setInputFiles({
    name: "synthetic-campus.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page
    .getByRole("button", { name: "Make this map interactive", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Map analysis result" })
    .waitFor({ timeout: 130000 });
  result.analysis = await page
    .getByRole("region", { name: "Map analysis result" })
    .innerText();
  assert.match(result.analysis, /2 places found/);
  const publish = page.getByRole("button", {
    name: "Open interactive map",
    exact: true,
  });
  await page.getByLabel(/I’ve checked/).check();
  assert.equal(await publish.isDisabled(), true);
  let reviewed = 0;
  while (
    await page
      .getByRole("button", { name: "Review next path", exact: true })
      .count()
  ) {
    assert.ok(reviewed++ < 40, "Synthetic network should remain bounded");
    await page
      .getByRole("button", { name: "Review next path", exact: true })
      .click();
    const choices = page.getByLabel(/^Walkable path to /);
    for (let i = 0; i < (await choices.count()); i++)
      if (!(await choices.nth(i).isChecked())) await choices.nth(i).check();
  }
  assert.ok(reviewed > 0, "The fixture must exercise detected edge review");
  await page.getByLabel(/I’ve checked/).check();
  assert.equal(await publish.isEnabled(), true);
  await page.screenshot({ path: `${output}/review-desktop.png` });
  await publish.click();
  await page
    .getByRole("button", { name: "Select Library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show walking route", exact: true })
    .click();
  assert.ok(
    await page.getByText("Distance not calibrated", { exact: true }).count(),
  );
  await page.getByLabel(/Step-free paths only/).check();
  await page.getByText(/No connected step-free path was marked/).waitFor();
  done(
    "Actual local OCR draft requires path review; unknown accessibility blocks step-free directions",
  );

  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit this map", exact: true })
    .click();
  await page.getByRole("button", { name: "Move map", exact: true }).click();
  const points = page.locator(".editor-point-list").last().getByRole("button");
  for (let i = 0; i < (await points.count()); i++) {
    await points.nth(i).click();
    const boxes = page.getByLabel(/^Verified step-free path to /);
    for (let j = 0; j < (await boxes.count()); j++)
      if (!(await boxes.nth(j).isChecked())) await boxes.nth(j).check();
  }
  await page.getByLabel(/I’ve checked/).check();
  await publish.click();
  await page
    .getByRole("button", { name: "Select Library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show walking route", exact: true })
    .click();
  await page.getByLabel(/Step-free paths only/).check();
  assert.equal(
    await page.getByText(/No connected step-free path was marked/).count(),
    0,
  );
  assert.ok(
    await page.getByText("Distance not calibrated", { exact: true }).count(),
  );
  done("Explicit accessibility review enables step-free routing");

  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Switch to night mode", exact: true })
    .click();
  await page.screenshot({ path: `${output}/route-mobile-night.png` });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("button", { name: "Switch to day mode", exact: true })
    .click();
  done("Prepared route renders on mobile/night without horizontal overflow");

  await connect();
  await page
    .locator(".connect-card")
    .filter({ hasText: "GreenExE" })
    .getByRole("button", { name: "Navigate", exact: true })
    .click();
  await page.getByRole("region", { name: "Campus map", exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Student Centre", exact: true })
    .waitFor();
  done(
    "Connect switches from an uploaded map to the exact Student Centre demo destination",
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.externalRequests, []);
  done("No page/console errors or external HTTP requests in this workflow");
} catch (error) {
  result.failure = error.stack;
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  process.exitCode = 1;
  console.error(error);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
