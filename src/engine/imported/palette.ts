/** Adapted from anti unieway/src/import/palette.mjs (MIT), © 2026 UniWay contributors. */
import type { PixelImage } from "../types";
import { components } from "./components";
import type { PaletteRegion } from "./types";

export function colorDistance(a: number[], b: number[]) {
  return Math.hypot(...a.map((v, i) => v - b[i]));
}
function hex(rgb: number[]) {
  return (
    "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")
  );
}

/** Hue/saturation bins tolerate antialiasing without requiring exact RGB equality. */
export function paletteRegions({
  data: pixels,
  width,
  height,
}: PixelImage): PaletteRegion[] {
  const mask = new Uint16Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    if (pixels[i * 4 + 3] < 128) continue;
    const r = pixels[i * 4],
      g = pixels[i * 4 + 1],
      b = pixels[i * 4 + 2];
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      d = max - min;
    if ((r + g + b) / 3 > 245 || max < 25) continue;
    if (d < 16) {
      if (max < 50 || max > 210) continue;
      mask[i] = 400 + Math.round(max / 15);
      continue;
    }
    const hue =
      ((max === r
        ? (g - b) / d
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4) *
        60 +
        360) %
      360;
    mask[i] =
      1 + Math.round(hue / 20) + Math.round((d / Math.max(1, max)) * 3) * 32;
  }
  const raw = components(mask, width, height)
    .filter((c) => c.pixels.length >= Math.max(5, width * height * 0.000008))
    .map((c) => {
      const rgb = [0, 0, 0];
      for (const i of c.pixels)
        for (let k = 0; k < 3; k++)
          rgb[k] += pixels[i * 4 + k] / c.pixels.length;
      return { ...c, rgb, color: hex(rgb) };
    });
  const merged: PaletteRegion[] = [];
  for (const region of raw.sort((a, b) => b.pixels.length - a.pixels.length)) {
    const match = merged.find(
      (c) =>
        colorDistance(c.rgb, region.rgb) < 80 &&
        c.x <= region.x + region.width &&
        region.x <= c.x + c.width &&
        c.y <= region.y + region.height &&
        region.y <= c.y + c.height,
    );
    if (!match) {
      merged.push({ ...region });
      continue;
    }
    const n = match.pixels.length,
      m = region.pixels.length;
    match.rgb = match.rgb.map((v, i) => (v * n + region.rgb[i] * m) / (n + m));
    const x = Math.min(match.x, region.x),
      y = Math.min(match.y, region.y);
    match.width = Math.max(match.x + match.width, region.x + region.width) - x;
    match.height =
      Math.max(match.y + match.height, region.y + region.height) - y;
    match.x = x;
    match.y = y;
    match.border ||= region.border;
    match.pixels = match.pixels.concat(region.pixels);
    match.color = hex(match.rgb);
  }
  return merged;
}

export function legendSwatches(
  regions: PaletteRegion[],
  width: number,
  height: number,
) {
  const small = regions.filter(
    (c) =>
      !c.border &&
      c.width <= width * 0.035 &&
      c.height <= height * 0.04 &&
      c.width >= 3 &&
      c.height >= 3 &&
      c.pixels.length / (c.width * c.height) > 0.45,
  );
  const groups: PaletteRegion[][] = [];
  for (const c of small) {
    let group = groups.find(
      (g) => Math.abs(g[0].x - c.x) < Math.max(5, width * 0.012),
    );
    if (!group) {
      group = [];
      groups.push(group);
    }
    group.push(c);
  }
  return groups
    .filter(
      (g) =>
        g.length >= 5 &&
        Math.max(...g.map((c) => c.y)) - Math.min(...g.map((c) => c.y)) >
          height * 0.12,
    )
    .flat()
    .sort((a, b) => a.y - b.y);
}

/** Strip a recognizable key, preserving Unicode scripts and genuine hyphenated names. */
export function cleanLegendName(text: string) {
  return text
    .replace(/^\s*(?:\d{1,3}[A-Za-z]?|[A-Za-z]{1,2}\d{0,3})\s*[-–—.:]\s*/u, "")
    .replace(/^\s*(?:\d{1,3}|[A-Z]\d{1,3})\s+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}
