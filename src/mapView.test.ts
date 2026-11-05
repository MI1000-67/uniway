import { describe, expect, it } from "vitest";
import { fitMapView, zoomView } from "./mapView";

describe("map zoom after fitting", () => {
  it("keeps a fitted desktop route clear of the floating sidebar and header", () => {
    const bounds = { x: 100, y: 100, w: 400, h: 600 };
    const size = { width: 1440, height: 900 };
    const padding = { left: 390, right: 85, top: 135, bottom: 105 };
    const view = fitMapView(bounds, size, padding);
    const scale = size.width / view.w;
    expect((bounds.x - view.x) * scale).toBeGreaterThanOrEqual(
      padding.left - 1e-8,
    );
    expect((bounds.y - view.y) * scale).toBeGreaterThanOrEqual(
      padding.top - 1e-8,
    );
    expect((bounds.x + bounds.w - view.x) * scale).toBeLessThanOrEqual(
      size.width - padding.right + 1e-8,
    );
    expect((bounds.y + bounds.h - view.y) * scale).toBeLessThanOrEqual(
      size.height - padding.bottom + 1e-8,
    );
  });
  it("keeps a mobile map between search and the compact bottom sheet", () => {
    const size = { width: 390, height: 844 };
    const view = fitMapView({ x: 0, y: 0, w: 300, h: 450 }, size, {
      left: 24,
      right: 64,
      top: 175,
      bottom: 342,
    });
    const scale = size.width / view.w;
    expect(-view.y * scale).toBeCloseTo(175);
    expect((450 - view.y) * scale).toBeCloseTo(502);
    expect(view.w / view.h).toBeCloseTo(size.width / size.height);
  });
  it("zooms in on a short mobile route while preserving its center and aspect ratio", () => {
    const view = { x: 100, y: 200, w: 195, h: 390 };
    const next = zoomView(view, 0.8);
    expect(next.w).toBeLessThan(view.w);
    expect(next.h / next.w).toBe(view.h / view.w);
    expect(next.x + next.w / 2).toBe(view.x + view.w / 2);
    expect(next.y + next.h / 2).toBe(view.y + view.h / 2);
  });
  it("zooms out from a campus fit wider than the old 1500-unit limit", () => {
    expect(zoomView({ x: 0, y: 0, w: 2300, h: 4600 }, 1.25).w).toBeGreaterThan(
      2300,
    );
  });
  it("never reverses zoom direction at or beyond either limit", () => {
    for (const w of [40, 80, 6000, 7000]) {
      const view = { x: 0, y: 0, w, h: w * 2 };
      expect(zoomView(view, 0.8).w).toBeLessThanOrEqual(w);
      expect(zoomView(view, 1.25).w).toBeGreaterThanOrEqual(w);
    }
  });
});
