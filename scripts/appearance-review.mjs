import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const url = process.env.UNIWAY_URL || "http://127.0.0.1:5173";
const output = "test-results/appearance";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
await page.addInitScript(() => localStorage.setItem("uniway.theme", "day"));
try {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole("button", { name: /Central Library.*Study spaces/ })
    .click();
  await page
    .getByRole("button", { name: "Get directions", exact: true })
    .click();
  assert.equal(await page.locator(".route-choice").count(), 3);
  assert.equal(
    await page
      .locator(".street-lamp-light")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity),
    "0",
  );
  assert.equal(
    await page
      .locator('[data-route-index="0"]')
      .evaluate((el) => getComputedStyle(el).stroke),
    "rgb(5, 140, 66)",
  );
  async function checkFrame(name) {
    const geometry = await page.evaluate(() => {
      const header = document
        .querySelector(".app-header")
        .getBoundingClientRect();
      const sidebar = document
        .querySelector(".sidebar")
        .getBoundingClientRect();
      const canvas = document
        .querySelector(".campus-svg")
        .getBoundingClientRect();
      const line = document.querySelector('[data-route-index="0"]');
      const transform = line.getScreenCTM();
      const route = Array.from(line.points)
        .map((p) => new DOMPoint(p.x, p.y).matrixTransform(transform))
        .map((p) => ({ x: p.x, y: p.y }));
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        header: header.toJSON(),
        sidebar: sidebar.toJSON(),
        canvas: canvas.toJSON(),
        route,
        width: innerWidth,
        height: innerHeight,
      };
    });
    assert.equal(geometry.overflow, false, `${name}: horizontal overflow`);
    assert.ok(
      geometry.sidebar.top >= geometry.header.bottom,
      `${name}: header/sidebar overlap`,
    );
    assert.equal(
      geometry.canvas.top,
      0,
      `${name}: map must extend behind header`,
    );
    for (const point of geometry.route) {
      assert.ok(
        point.y > geometry.header.bottom && point.y < geometry.height,
        `${name}: route offscreen`,
      );
      if (geometry.width > 900)
        assert.ok(
          point.x > geometry.sidebar.right,
          `${name}: route beneath sidebar`,
        );
      else
        assert.ok(
          point.y < geometry.sidebar.top,
          `${name}: route beneath bottom sheet`,
        );
    }
    await page.screenshot({ path: `${output}/${name}.png` });
    return geometry;
  }
  const results = { desktopDay: await checkFrame("desktop-day") };
  await page.getByRole("button", { name: "Switch to night mode" }).click();
  assert.equal(
    await page
      .locator(".street-lamp-light")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity),
    "1",
  );
  results.desktopNight = await checkFrame("desktop-night");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.getByRole("button", { name: "Fit route", exact: true }).click();
  await page.getByRole("button", { name: /Explore campus/ }).click();
  await page.getByRole("button", { name: "Fit route", exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole("button", { name: "Fit route", exact: true }).click();
  results.tablet = await checkFrame("tablet-night");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Fit route", exact: true }).click();
  results.mobileNight = await checkFrame("mobile-night");
  await page.getByRole("button", { name: "Switch to day mode" }).click();
  results.mobileDay = await checkFrame("mobile-day");
  await page.getByRole("button", { name: "Map compass and rotation" }).click();
  const panel = await page.locator(".map-compass-panel").boundingBox();
  assert.ok(
    panel.x >= 0 && panel.x + panel.width <= 390,
    "compass panel overflows",
  );
  await page.getByRole("button", { name: "Close compass controls" }).click();
  await page.getByRole("button", { name: "Expand destination panel" }).click();
  await page.getByRole("button", { name: /Alternative 2.*Dotted/ }).click();
  assert.equal(
    await page.locator(".route-choice[aria-pressed=true] strong").textContent(),
    "Alternative 2",
  );
  await page
    .getByRole("button", { name: "Collapse destination panel" })
    .click();
  await page.setViewportSize({ width: 360, height: 720 });
  await page.getByRole("button", { name: "Fit route", exact: true }).click();
  await page.screenshot({ path: `${output}/small-mobile.png` });
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ ...results, errors }, null, 2),
  );
  console.log(
    "Appearance checks passed: day/night, lamps, exact accent, full map, unobscured routes, mobile, compass, sidebar and route selection.",
  );
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  await writeFile(
    `${output}/failure.txt`,
    await page.locator("body").innerText(),
  );
  throw error;
} finally {
  await browser.close();
}
