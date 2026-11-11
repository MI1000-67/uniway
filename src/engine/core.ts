import type { PathEdge, PathNode, Category } from "../campus";
import type { MapPlace } from "../preparedMap";
import { detectedEdge } from "../mapEdges";
import type { Crop, DetectedLabel, OCRLine, PixelImage } from "./types";
import { detectWalls } from "./imported/floorplan";

type Component = {
  pixels: number[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};
function components(
  mask: Uint8Array,
  width: number,
  height: number,
): Component[] {
  const seen = new Uint8Array(mask.length),
    out: Component[] = [];
  const queue = new Int32Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    seen[i] = 1;
    let start = 0,
      end = 1;
    queue[0] = i;
    const c: Component = { pixels: [], x0: width, y0: height, x1: 0, y1: 0 };
    while (start < end) {
      const p = queue[start++],
        x = p % width,
        y = (p / width) | 0;
      c.pixels.push(p);
      c.x0 = Math.min(c.x0, x);
      c.x1 = Math.max(c.x1, x);
      c.y0 = Math.min(c.y0, y);
      c.y1 = Math.max(c.y1, y);
      for (const n of [
        x ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ]) {
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = 1;
          queue[end++] = n;
        }
      }
    }
    out.push(c);
  }
  return out;
}

// Find small, light marker interiors on colored diagram regions, independent of
// campus identity. Supports both light circular badges and light digits on dark/colored buildings.
export function findNumberBadges(image: PixelImage): Crop[] {
  const { width: w, height: h, data } = image,
    mask = new Uint8Array(w * h);
  for (let p = 0; p < mask.length; p++) {
    const i = p * 4,
      max = Math.max(data[i], data[i + 1], data[i + 2]),
      min = Math.min(data[i], data[i + 1], data[i + 2]);
    if (min > 216 && max - min < 27) mask[p] = 1;
  }
  const maxDiameter = Math.max(22, Math.min(w, h) * 0.045);
  const light = components(mask, w, h)
    .filter((c) => {
      const bw = c.x1 - c.x0 + 1,
        bh = c.y1 - c.y0 + 1;
      if (
        bw < 7 ||
        bh < 7 ||
        bw > maxDiameter ||
        bh > maxDiameter ||
        bw / bh < 0.5 ||
        bw / bh > 1.8 ||
        c.pixels.length < 18
      )
        return false;
      const fillRatio = c.pixels.length / (bw * bh);
      if (fillRatio < 0.45) return false;
      const cx = (c.x0 + c.x1) / 2,
        cy = (c.y0 + c.y1) / 2,
        r = Math.max(bw, bh) * 0.8;
      let qTop = false,
        qBot = false,
        qLeft = false,
        qRight = false;
      for (let a = 0; a < 8; a++) {
        const x = Math.round(cx + Math.cos((a * Math.PI) / 4) * r),
          y = Math.round(cy + Math.sin((a * Math.PI) / 4) * r);
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const i = (y * w + x) * 4;
        const sat =
          Math.max(data[i], data[i + 1], data[i + 2]) -
          Math.min(data[i], data[i + 1], data[i + 2]);
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (sat > 18 || lum < 185) {
          if (a === 0 || a === 1 || a === 7) qRight = true;
          if (a === 1 || a === 2 || a === 3) qBot = true;
          if (a === 3 || a === 4 || a === 5) qLeft = true;
          if (a === 5 || a === 6 || a === 7) qTop = true;
        }
      }
      const quadrants =
        (qTop ? 1 : 0) + (qBot ? 1 : 0) + (qLeft ? 1 : 0) + (qRight ? 1 : 0);
      return quadrants >= 3;
    })
    .map((c) => ({
      x: c.x0,
      y: c.y0,
      width: c.x1 - c.x0 + 1,
      height: c.y1 - c.y0 + 1,
    }));
  const ink = new Uint8Array(w * h);
  for (let p = 0; p < ink.length; p++) {
    const i = p * 4,
      hi = Math.max(data[i], data[i + 1], data[i + 2]),
      lo = Math.min(data[i], data[i + 1], data[i + 2]);
    if (hi < 170 && hi - lo < 40) ink[p] = 1;
  }
  const rings = components(ink, w, h)
    .filter((c) => {
      const bw = c.x1 - c.x0 + 1,
        bh = c.y1 - c.y0 + 1;
      if (
        bw < 12 ||
        bh < 12 ||
        bw > maxDiameter ||
        bh > maxDiameter ||
        bw / bh < 0.8 ||
        bw / bh > 1.25
      )
        return false;
      let rim = 0;
      const cx = (c.x0 + c.x1) / 2,
        cy = (c.y0 + c.y1) / 2;
      for (let a = 0; a < 16; a++) {
        const x = Math.round(cx + (Math.cos((a * Math.PI) / 8) * (bw - 2)) / 2),
          y = Math.round(cy + (Math.sin((a * Math.PI) / 8) * (bh - 2)) / 2);
        if (ink[y * w + x]) rim++;
      }
      return rim >= 12 && c.pixels.length / (bw * bh) < 0.65;
    })
    .map((c) => ({
      x: c.x0 + 2,
      y: c.y0 + 2,
      width: c.x1 - c.x0 - 3,
      height: c.y1 - c.y0 - 3,
    }));

  // Detect white/light text or digits printed directly on dark or colored buildings
  const whiteTextMask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4,
      min = Math.min(data[i], data[i + 1], data[i + 2]),
      max = Math.max(data[i], data[i + 1], data[i + 2]);
    if (min > 195 && max - min < 35) whiteTextMask[p] = 1;
  }
  const whiteTextComps = components(whiteTextMask, w, h).filter((c) => {
    const bw = c.x1 - c.x0 + 1,
      bh = c.y1 - c.y0 + 1;
    if (bw < 2 || bh < 4 || bw > maxDiameter * 1.5 || bh > maxDiameter)
      return false;
    // Check border around this component on all sides for dark or colored building background
    let topDark = false,
      bottomDark = false,
      leftDark = false,
      rightDark = false;
    for (let x = Math.max(0, c.x0 - 2); x <= Math.min(w - 1, c.x1 + 2); x++) {
      const topIdx = (Math.max(0, c.y0 - 2) * w + x) * 4;
      const topLum = (data[topIdx] + data[topIdx + 1] + data[topIdx + 2]) / 3;
      const topSat =
        Math.max(data[topIdx], data[topIdx + 1], data[topIdx + 2]) -
        Math.min(data[topIdx], data[topIdx + 1], data[topIdx + 2]);
      if (topLum < 175 || topSat > 18) topDark = true;

      const botIdx = (Math.min(h - 1, c.y1 + 2) * w + x) * 4;
      const botLum = (data[botIdx] + data[botIdx + 1] + data[botIdx + 2]) / 3;
      const botSat =
        Math.max(data[botIdx], data[botIdx + 1], data[botIdx + 2]) -
        Math.min(data[botIdx], data[botIdx + 1], data[botIdx + 2]);
      if (botLum < 175 || botSat > 18) bottomDark = true;
    }
    for (let y = Math.max(0, c.y0 - 2); y <= Math.min(h - 1, c.y1 + 2); y++) {
      const leftIdx = (y * w + Math.max(0, c.x0 - 2)) * 4;
      const leftLum =
        (data[leftIdx] + data[leftIdx + 1] + data[leftIdx + 2]) / 3;
      const leftSat =
        Math.max(data[leftIdx], data[leftIdx + 1], data[leftIdx + 2]) -
        Math.min(data[leftIdx], data[leftIdx + 1], data[leftIdx + 2]);
      if (leftLum < 175 || leftSat > 18) leftDark = true;

      const rightIdx = (y * w + Math.min(w - 1, c.x1 + 2)) * 4;
      const rightLum =
        (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
      const rightSat =
        Math.max(data[rightIdx], data[rightIdx + 1], data[rightIdx + 2]) -
        Math.min(data[rightIdx], data[rightIdx + 1], data[rightIdx + 2]);
      if (rightLum < 175 || rightSat > 18) rightDark = true;
    }
    const sidesWithBackground =
      (topDark ? 1 : 0) +
      (bottomDark ? 1 : 0) +
      (leftDark ? 1 : 0) +
      (rightDark ? 1 : 0);
    if (sidesWithBackground < 3) return false;

    // Must be genuinely inside a dark building, not on a thin line with white paper nearby
    let nearWhite = false;
    for (let dy = -6; dy <= bh + 6; dy += 3) {
      for (let dx = -6; dx <= bw + 6; dx += 3) {
        const nx = c.x0 + dx,
          ny = c.y0 + dy;
        if (nx >= c.x0 && nx <= c.x1 && ny >= c.y0 && ny <= c.y1) continue;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const idx = (ny * w + nx) * 4;
        const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        if (lum > 220) {
          nearWhite = true;
          break;
        }
      }
      if (nearWhite) break;
    }
    return !nearWhite;
  });

  // Group horizontally adjacent digit components (e.g. '2' and '4' for '24')
  const mergedDigits: Crop[] = [];
  const usedComps = new Set<number>();
  for (let i = 0; i < whiteTextComps.length; i++) {
    if (usedComps.has(i)) continue;
    usedComps.add(i);
    const group = [whiteTextComps[i]];
    for (let j = i + 1; j < whiteTextComps.length; j++) {
      if (usedComps.has(j)) continue;
      const a = whiteTextComps[i],
        b = whiteTextComps[j];
      if (Math.abs(a.y0 - b.y0) < 6 && Math.abs(a.x1 - b.x0) < 9) {
        usedComps.add(j);
        group.push(b);
      }
    }
    const x0 = Math.min(...group.map((c) => c.x0));
    const y0 = Math.min(...group.map((c) => c.y0));
    const x1 = Math.max(...group.map((c) => c.x1));
    const y1 = Math.max(...group.map((c) => c.y1));
    mergedDigits.push({
      x: x0,
      y: y0,
      width: x1 - x0 + 1,
      height: y1 - y0 + 1,
    });
  }

  const out = [...rings];
  for (const b of light.sort((a, b) => b.width * b.height - a.width * a.height))
    if (
      !out.some(
        (a) =>
          Math.hypot(
            a.x + a.width / 2 - b.x - b.width / 2,
            a.y + a.height / 2 - b.y - b.height / 2,
          ) < 8,
      )
    )
      out.push(b);

  for (const b of mergedDigits)
    if (
      !out.some(
        (a) =>
          Math.hypot(
            a.x + a.width / 2 - b.x - b.width / 2,
            a.y + a.height / 2 - b.y - b.height / 2,
          ) < 10,
      )
    )
      out.push(b);

  // Filter out repetitive collinear dashed line patterns (e.g. boundary strokes, roadway dashes)
  const isDashedLine = (candidate: Crop, all: Crop[]) => {
    const nearby = all.filter(
      (other) =>
        other !== candidate &&
        Math.hypot(other.x - candidate.x, other.y - candidate.y) < 40 &&
        Math.abs(other.width - candidate.width) < 12 &&
        Math.abs(other.height - candidate.height) < 12,
    );
    if (nearby.length >= 2) {
      for (const n1 of nearby) {
        for (const n2 of nearby) {
          if (n1 === n2) continue;
          const dx1 = n1.x - candidate.x,
            dy1 = n1.y - candidate.y;
          const dx2 = candidate.x - n2.x,
            dy2 = candidate.y - n2.y;
          const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
          const dot = dx1 * dx2 + dy1 * dy2;
          if (dot > 0 && cross < 80) return true;
        }
      }
    }
    return false;
  };

  return out
    .filter((c) => !isDashedLine(c, out))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, 150);
}

// Remove a badge's enclosing ring and colored surroundings before digit OCR.
// Supports both dark ink on light badge and light digits on dark building.
export function cleanNumberBadge(image: PixelImage, crop: Crop): PixelImage {
  const pad = 4,
    x0 = Math.max(0, crop.x - pad),
    y0 = Math.max(0, crop.y - pad);
  const w = Math.min(image.width - x0, crop.width + pad * 2),
    h = Math.min(image.height - y0, crop.height + pad * 2);
  const mask = new Uint8Array(w * h),
    data = new Uint8ClampedArray(w * h * 4).fill(255);

  // Determine polarity: sample outer border of the crop
  let borderLumSum = 0,
    borderCount = 0;
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = ((y + y0) * image.width + x + x0) * 4;
      borderLumSum +=
        (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
      borderCount++;
    }
  }
  for (let y = 1; y < h - 1; y++) {
    for (const x of [0, w - 1]) {
      const i = ((y + y0) * image.width + x + x0) * 4;
      borderLumSum +=
        (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
      borderCount++;
    }
  }
  const isLightTextOnDark = borderCount > 0 && borderLumSum / borderCount < 165;

  if (isLightTextOnDark) {
    // White/light digits on dark building: invert so digits become crisp black on white
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = ((y + y0) * image.width + x + x0) * 4;
        const lum = (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
        if (lum > 165) mask[y * w + x] = 1;
      }
    for (const c of components(mask, w, h)) {
      if (c.pixels.length < 3) continue;
      for (const p of c.pixels) {
        data[p * 4] = 0;
        data[p * 4 + 1] = 0;
        data[p * 4 + 2] = 0;
      }
    }
  } else {
    // Dark ink on light badge
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = ((y + y0) * image.width + x + x0) * 4;
        if (Math.max(image.data[i], image.data[i + 1], image.data[i + 2]) < 150)
          mask[y * w + x] = 1;
      }
    for (const c of components(mask, w, h)) {
      const bw = c.x1 - c.x0 + 1,
        bh = c.y1 - c.y0 + 1;
      if (
        c.x0 === 0 ||
        c.y0 === 0 ||
        c.x1 === w - 1 ||
        c.y1 === h - 1 ||
        c.pixels.length < 3
      )
        continue;
      if (bw > w * 0.7 && bh > h * 0.7) continue;
      for (const p of c.pixels) {
        data[p * 4] = 0;
        data[p * 4 + 1] = 0;
        data[p * 4 + 2] = 0;
      }
    }
  }
  return { data, width: w, height: h };
}

export function findLegendRegions(
  lines: OCRLine[],
  width: number,
  height: number,
): Crop[] {
  const groups: OCRLine[][] = [];
  for (const line of lines.filter(
    (l) =>
      l.confidence > 40 &&
      l.text.length > 5 &&
      /(?:\p{L}\p{M}*){2}/u.test(l.text) &&
      (l.bbox.y0 > height * 0.4 ||
        /^\s*\d{1,3}[.),:\-–\s]/u.test(l.text) ||
        /key|legend|directory|index/i.test(l.text)),
  )) {
    const group = groups.find(
      (g) => Math.abs(g[0].bbox.x0 - line.bbox.x0) < width * 0.035,
    );
    if (group) group.push(line);
    else groups.push([line]);
  }
  return groups
    .filter((g) => g.length >= 2)
    .map((g) => {
      const x = Math.max(
          0,
          Math.min(...g.map((l) => l.bbox.x0)) - width * 0.04,
        ),
        y = Math.max(0, Math.min(...g.map((l) => l.bbox.y0)) - 10);
      return {
        x: Math.floor(x),
        y: Math.floor(y),
        width: Math.min(
          width - Math.floor(x),
          Math.ceil(Math.max(...g.map((l) => l.bbox.x1)) - x + 16),
        ),
        height: Math.min(
          height - Math.floor(y),
          Math.ceil(Math.max(...g.map((l) => l.bbox.y1)) - y + 16),
        ),
      };
    })
    .slice(0, 10);
}

export function flattenOCR(
  blocks: unknown,
  scale = 1,
  offset = { x: 0, y: 0 },
): OCRLine[] {
  const lines: OCRLine[] = [];
  const box = (b: { x0: number; y0: number; x1: number; y1: number }) => ({
    x0: b.x0 / scale + offset.x,
    y0: b.y0 / scale + offset.y,
    x1: b.x1 / scale + offset.x,
    y1: b.y1 / scale + offset.y,
  });
  // Shape is the documented Tesseract blocks -> paragraphs -> lines hierarchy.
  for (const b of (blocks ?? []) as { paragraphs?: { lines?: OCRLine[] }[] }[])
    for (const p of b.paragraphs ?? [])
      for (const line of p.lines ?? []) {
        lines.push({
          text: line.text.trim(),
          confidence: line.confidence,
          bbox: box(line.bbox),
          words: line.words.map((word) => ({ ...word, bbox: box(word.bbox) })),
        });
      }
  return lines;
}

function clean(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[|~_\s]+|[|~_\s]+$/g, "")
    .trim();
}
const numberOf = (s: string) =>
  /^[([\s]*\d{1,3}[.)\]\s]*$/.test(s)
    ? String(Number(s.replace(/\D/g, "")))
    : null;
export function extractLabels(
  lines: OCRLine[],
  markers: { number: string; x: number; y: number; confidence: number }[],
  width: number,
  height: number,
): DetectedLabel[] {
  const numbered = lines
    .flatMap((line) =>
      line.words.map((word) => ({
        number: numberOf(word.text),
        bbox: word.bbox,
        confidence: word.confidence,
      })),
    )
    .filter((item) => item.number && item.confidence >= 25);
  const legend = new Map<
    string,
    {
      text: string;
      confidence: number;
      bbox: OCRLine["bbox"];
      aliases: string[];
    }
  >();
  const usedLines = new Set<OCRLine>();
  for (const entry of numbered) {
    const b = entry.bbox,
      cy = (b.y0 + b.y1) / 2,
      lh = b.y1 - b.y0;
    let candidates = lines.filter(
      (line) =>
        line.confidence >= 25 &&
        /(?:\p{L}\p{M}*){2}/u.test(line.text) &&
        line.bbox.x0 >= b.x1 - 4 &&
        line.bbox.x0 - b.x1 < Math.max(90, lh * 8) &&
        Math.abs((line.bbox.y0 + line.bbox.y1) / 2 - cy) <
          Math.max(6, lh * 0.8),
    );
    candidates = candidates.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const line = candidates[0];
    if (line) {
      legend.set(entry.number!, {
        text: clean(line.text),
        confidence: Math.min(entry.confidence, line.confidence),
        bbox: line.bbox,
        aliases: [],
      });
      usedLines.add(line);
    }
  }
  // Single-block OCR often keeps the numeric key and name in the same line.
  // Match e.g. "1. Allen Field" or "18, Prentice Hall" or "2 Badal Nafus Student Union"
  for (const line of lines) {
    const match = line.text.match(/^\s*(\d{1,3})[.),:\-–\s]\s+(.{2,})$/u);
    if (
      match &&
      line.confidence >= 25 &&
      /(?:\p{L}\p{M}*){2}/u.test(match[2])
    ) {
      const num = String(Number(match[1]));
      if (
        !legend.has(num) ||
        line.confidence > (legend.get(num)?.confidence ?? 0)
      ) {
        legend.set(num, {
          text: clean(match[2]),
          confidence: line.confidence,
          bbox: line.bbox,
          aliases: [],
        });
        usedLines.add(line);
      }
    }
  }

  // Attach sub-bullets / aliases (e.g. "+ Admissions", "+ IT Help Desk") to preceding numbered entry
  for (const line of lines) {
    const bullet = line.text.match(/^\s*[-+*•·]\s*(.{3,})$/u);
    if (bullet && line.confidence >= 25) {
      const text = clean(bullet[1]);
      if (text.length >= 3 && !/\b(map|parking)\b/i.test(text)) {
        let bestKey: string | null = null;
        let bestDist = Infinity;
        for (const [k, v] of legend.entries()) {
          const dy = line.bbox.y0 - v.bbox.y1;
          const dx = Math.abs(line.bbox.x0 - v.bbox.x0);
          if (dy >= -6 && dy < height * 0.16 && dx < width * 0.12) {
            if (dy < bestDist) {
              bestDist = dy;
              bestKey = k;
            }
          }
        }
        if (bestKey && legend.has(bestKey)) {
          legend.get(bestKey)!.aliases.push(text);
          usedLines.add(line);
        }
      }
    }
  }

  const output: DetectedLabel[] = [];
  for (const marker of markers) {
    // A key normally identifies one building. If OCR reads the same number in
    // two locations, retain only a clearly stronger match; never clone a label.
    const rivals = markers.filter(
      (other) =>
        other !== marker &&
        other.number === marker.number &&
        Math.hypot(other.x - marker.x, other.y - marker.y) > 12,
    );
    if (rivals.some((other) => other.confidence >= marker.confidence - 12))
      continue;
    const entry = legend.get(marker.number);
    if (!entry) continue;
    // Reject a marker in its own key row, plus duplicate detections of one badge.
    if (Math.hypot(marker.x - entry.bbox.x0, marker.y - entry.bbox.y0) < 40)
      continue;
    if (
      output.some(
        (o) =>
          o.number === marker.number &&
          Math.hypot(o.x - marker.x, o.y - marker.y) < 35,
      )
    )
      continue;
    output.push({
      text: entry.text,
      x: marker.x,
      y: marker.y,
      confidence: Math.min(entry.confidence, marker.confidence),
      source: "legend",
      number: marker.number,
      aliases: entry.aliases.length ? entry.aliases : undefined,
    });
  }
  // Only use direct in-map labels if no numbered key was found. Otherwise OCR
  // fragments of the key must never turn into destinations in the page margin.
  if (legend.size < 3)
    for (const line of lines) {
      if (usedLines.has(line)) continue;
      const isRoom =
        /^[A-Za-z]{1,3}-?\d{1,4}[A-Za-z]?$|^[A-Za-z]\s*\d{1,4}$|^\d{1,4}[A-Za-z]?$/i.test(
          line.text.trim(),
        ) ||
        /\b(room|rm|office|lab|conference|wc|toilet|restroom|stairs|staircase|lift|elevator|corridor|entrance|exit|lobby|cafe|kitchen|storage|auditorium|lounge|dining|staff|lecture\s*hall|computer\s*room|you\s*are\s*here|academic\s*staff|washroom)\b/i.test(
          line.text,
        );
      const minConfidence = isRoom ? 20 : 50;
      if (line.confidence < minConfidence) continue;
      if (!isRoom && !/(?:\p{L}\p{M}*){3}/u.test(line.text)) continue;
      const { bbox: b } = line,
        x = (b.x0 + b.x1) / 2,
        y = (b.y0 + b.y1) / 2;
      const maxHeight = isRoom ? height * 0.08 : height * 0.035;
      if (
        b.y1 - b.y0 > maxHeight ||
        x < width * 0.03 ||
        x > width * 0.97 ||
        y < height * 0.04 ||
        y > height * 0.96 ||
        line.text.length > 80
      )
        continue;
      if (
        /map|legend|scale|copyright|floor plan|ground floor|lower level|campus|university|north/i.test(
          line.text,
        ) &&
        !isRoom
      )
        continue;
      const text = clean(line.text);
      const minLen = isRoom ? 2 : 4;
      if (
        text.length < minLen ||
        output.some((o) => o.text === text && Math.hypot(o.x - x, o.y - y) < 40)
      )
        continue;
      output.push({ text, x, y, confidence: line.confidence, source: "label" });
    }
  return output.slice(0, 100);
}

// Zhang-Suen thinning preserves the topology of a confirmed raster component.
export function thin(mask: Uint8Array, w: number, h: number): Uint8Array {
  const m = mask.slice(),
    remove: number[] = [];
  for (let iteration = 0; iteration < 100; iteration++) {
    let changed = false;
    for (let pass = 0; pass < 2; pass++) {
      remove.length = 0;
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!m[i]) continue;
          const p = [
            m[i - w],
            m[i - w + 1],
            m[i + 1],
            m[i + w + 1],
            m[i + w],
            m[i + w - 1],
            m[i - 1],
            m[i - w - 1],
          ];
          const n = p.reduce((a, b) => a + b, 0);
          if (n < 2 || n > 6) continue;
          let transitions = 0;
          for (let k = 0; k < 8; k++)
            if (!p[k] && p[(k + 1) % 8]) transitions++;
          if (transitions !== 1) continue;
          if (
            pass === 0
              ? p[0] * p[2] * p[4] || p[2] * p[4] * p[6]
              : p[0] * p[2] * p[6] || p[0] * p[4] * p[6]
          )
            continue;
          remove.push(i);
        }
      for (const i of remove) m[i] = 0;
      changed ||= remove.length > 0;
    }
    if (!changed) break;
  }
  return m;
}

export type Linework = {
  nodes: PathNode[];
  edges: PathEdge[];
  mask: Uint8Array;
  coverage: number;
};
export function extractLinework(image: PixelImage): Linework {
  const { data, width: w, height: h } = image,
    mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) {
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2],
      lo = Math.min(r, g, b),
      hi = Math.max(r, g, b);
    // Neutral mid-tone filled paths.
    const isNeutral = lo > 85 && hi < 225 && hi - lo < 18;
    // Warm-neutral, tan, beige, sand, cream walkways (e.g. r,g,b around 190, 180, 160).
    const isBeige =
      lo > 95 && hi < 235 && hi - lo < 52 && r >= g - 6 && g >= b - 18;
    // Asphalt / darker paved roadways.
    const isAsphalt = lo > 70 && hi < 185 && hi - lo < 25;
    if (isNeutral || isBeige || isAsphalt) mask[i] = 1;
  }
  const kept = new Uint8Array(mask.length);
  const candidates = components(mask, w, h)
    .filter((c) => {
      const area = c.pixels.length,
        bw = c.x1 - c.x0 + 1,
        bh = c.y1 - c.y0 + 1;
      return (
        area > Math.max(80, w * h * 0.0008) &&
        Math.max(bw / w, bh / h) > 0.15 &&
        area / (bw * bh) < 0.45 &&
        area / (w * h) < 0.22
      );
    })
    .sort((a, b) => b.pixels.length - a.pixels.length)
    .slice(0, 12);
  for (const c of candidates) for (const i of c.pixels) kept[i] = 1;
  const coverage =
    candidates.reduce((n, c) => n + c.pixels.length, 0) / (w * h);
  // Small enclosed white paint marks are part of the same drawn road, not
  // independent corridors. Preserve colored obstacles and large open regions.
  const holes = new Uint8Array(kept.length);
  for (let i = 0; i < holes.length; i++) holes[i] = kept[i] ? 0 : 1;
  for (const c of components(holes, w, h)) {
    if (
      c.x0 === 0 ||
      c.y0 === 0 ||
      c.x1 === w - 1 ||
      c.y1 === h - 1 ||
      c.pixels.length > Math.max(100, w * h * 0.0003)
    )
      continue;
    const white = c.pixels.filter(
      (p) => Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) > 215,
    ).length;
    if (white / c.pixels.length > 0.75) for (const p of c.pixels) kept[p] = 1;
  }
  const skeleton = thin(kept, w, h);
  return { ...skeletonToGraph(skeleton, w, h), mask: kept, coverage };
}

export function skeletonToGraph(
  skeleton: Uint8Array,
  w: number,
  h: number,
  defaultLandmark = "the marked path",
): { nodes: PathNode[]; edges: PathEdge[] } {
  const neighbors = (p: number) => {
    const x = p % w,
      y = (p / w) | 0,
      out: number[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (dx || dy) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (!skeleton[n]) continue;
          // Remove redundant diagonal triangles around right-angle corners.
          if (dx && dy && (skeleton[y * w + nx] || skeleton[ny * w + x]))
            continue;
          out.push(n);
        }
    return out;
  };
  const key = new Set<number>();
  for (let p = 0; p < skeleton.length; p++)
    if (skeleton[p] && neighbors(p).length !== 2) key.add(p);
  // A closed loop has no endpoints; retain one seed for each such component.
  const visited = new Set<number>();
  for (let p = 0; p < skeleton.length; p++)
    if (skeleton[p] && !visited.has(p)) {
      const q = [p];
      visited.add(p);
      let hasKey = false;
      for (let i = 0; i < q.length; i++) {
        hasKey ||= key.has(q[i]);
        for (const n of neighbors(q[i]))
          if (!visited.has(n)) {
            visited.add(n);
            q.push(n);
          }
      }
      if (!hasKey) key.add(p);
    }
  const nodes: PathNode[] = [],
    edges: PathEdge[] = [],
    ids = new Map<number, string>(),
    seenEdges = new Set<string>();
  const node = (p: number) => {
    let id = ids.get(p);
    if (!id) {
      id = `auto-path-${nodes.length}`;
      ids.set(p, id);
      nodes.push({ id, x: p % w, y: (p / w) | 0, landmark: defaultLandmark });
    }
    return id;
  };
  const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  for (const start of [...key])
    for (const next of neighbors(start)) {
      if (seenEdges.has(edgeKey(start, next))) continue;
      let previous = start,
        current = next,
        last = start,
        distance = 0;
      node(start);
      for (let limit = 0; limit < w * h; limit++) {
        seenEdges.add(edgeKey(previous, current));
        distance += Math.hypot(
          (current % w) - (previous % w),
          ((current / w) | 0) - ((previous / w) | 0),
        );
        // Short sampling keeps curved paths faithful to the detected pixels.
        if (distance >= 6 || key.has(current)) {
          if (last !== current)
            edges.push({
              from: node(last),
              to: node(current),
              stepFree: false,
            });
          last = current;
          distance = 0;
        }
        if (key.has(current)) break;
        const options = neighbors(current).filter((n) => n !== previous);
        if (options.length !== 1) break;
        previous = current;
        current = options[0];
      }
    }
  return simplifyLinework(nodes, edges);
}

/** Check line of sight across a wall mask; out-of-bounds points are not evidence. */
export function hasLineOfSight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  wallMask: Uint8Array,
  width: number,
  height: number,
  clearance = 0,
): boolean {
  if (
    ![x0, y0, x1, y1].every(Number.isFinite) ||
    Math.min(x0, x1) < 0 ||
    Math.min(y0, y1) < 0 ||
    Math.max(x0, x1) > width - 1 ||
    Math.max(y0, y1) > height - 1
  )
    return false;
  const ix0 = Math.round(x0),
    iy0 = Math.round(y0);
  const ix1 = Math.round(x1),
    iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0);
  const dy = Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx - dy;
  let cx = ix0;
  let cy = iy0;
  const maxSteps = (dx + dy) * 2 + 10;
  for (let step = 0; step < maxSteps; step++) {
    for (let ox = -clearance; ox <= clearance; ox++) {
      for (let oy = -clearance; oy <= clearance; oy++) {
        const px = cx + ox,
          py = cy + oy;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          if (wallMask[py * width + px]) return false;
        }
      }
    }
    if (cx === ix1 && cy === iy1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return true;
}

/** Extract indoor corridor paths and room connections without crossing walls. */
export function extractIndoorLinework(
  image: PixelImage,
  candidateRegions: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [],
): Linework {
  const { width: w, height: h } = image;
  const wallMask = detectWalls(image);
  const openMask = new Uint8Array(w * h);
  for (let i = 0; i < wallMask.length; i++) {
    openMask[i] = wallMask[i] ? 0 : 1;
  }
  const openComps = components(openMask, w, h);
  const exterior = openComps.find(
    (c) =>
      (c.x0 === 0 || c.y0 === 0 || c.x1 === w - 1 || c.y1 === h - 1) &&
      c.pixels.length > w * h * 0.08,
  );
  const chambers = openComps.filter(
    (c) => c !== exterior && c.pixels.length >= Math.max(25, w * h * 0.0004),
  );

  const corridorMask = new Uint8Array(w * h);
  let corridorPixelCount = 0;
  for (const c of chambers) {
    const bw = c.x1 - c.x0 + 1;
    const bh = c.y1 - c.y0 + 1;
    const aspect = Math.max(bw / bh, bh / bw);
    const fillRatio = c.pixels.length / (bw * bh);
    const isCorridor =
      aspect > 2.0 ||
      c.pixels.length > w * h * 0.04 ||
      (fillRatio < 0.45 && c.pixels.length > 80);
    if (isCorridor) {
      for (const p of c.pixels) {
        corridorMask[p] = 1;
        corridorPixelCount++;
      }
    }
  }

  // Fallback: if no chamber was singled out as a corridor, check if candidateRegions define room interiors
  if (corridorPixelCount < 40 && candidateRegions.length > 0) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const r of candidateRegions) {
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.width > maxX) maxX = r.x + r.width;
      if (r.y + r.height > maxY) maxY = r.y + r.height;
    }
    const pad = Math.max(16, Math.round(Math.min(w, h) * 0.04));
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * w + x;
        if (wallMask[idx] === 1) continue;
        let inRoom = false;
        for (const r of candidateRegions) {
          if (
            x >= r.x + 6 &&
            x <= r.x + r.width - 6 &&
            y >= r.y + 6 &&
            y <= r.y + r.height - 6
          ) {
            inRoom = true;
            break;
          }
        }
        if (!inRoom) {
          corridorMask[idx] = 1;
          corridorPixelCount++;
        }
      }
    }
  }

  // Second fallback: if still empty, use all internal open chambers
  if (corridorPixelCount < 40) {
    for (const c of chambers) {
      for (const p of c.pixels) {
        corridorMask[p] = 1;
        corridorPixelCount++;
      }
    }
  }

  const skeleton = thin(corridorMask, w, h);
  const graph = skeletonToGraph(skeleton, w, h, "the corridor");
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];

  // If skeleton produced no nodes, create centroid nodes for chambers
  if (nodes.length === 0 && chambers.length > 0) {
    for (let i = 0; i < chambers.length; i++) {
      const c = chambers[i];
      nodes.push({
        id: `auto-corridor-${i}`,
        x: Math.round((c.x0 + c.x1) / 2),
        y: Math.round((c.y0 + c.y1) / 2),
        landmark: "the corridor",
      });
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j];
        if (
          Math.hypot(a.x - b.x, a.y - b.y) < Math.max(w, h) * 0.45 &&
          hasLineOfSight(a.x, a.y, b.x, b.y, wallMask, w, h)
        ) {
          const isStairs = /stair|steps/i.test(a.landmark || b.landmark || "");
          edges.push({ from: a.id, to: b.id, stepFree: !isStairs });
        }
      }
    }
  }

  // Connect rooms/regions to the corridor network without penetrating walls
  for (let r = 0; r < candidateRegions.length; r++) {
    const room = candidateRegions[r];
    const rx = Math.round(room.x + room.width / 2);
    const ry = Math.round(room.y + room.height / 2);
    let bestNode: PathNode | null = null;
    let bestDist = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - rx, n.y - ry);
      if (d < bestDist && d < Math.max(w, h) * 0.35) {
        if (hasLineOfSight(rx, ry, n.x, n.y, wallMask, w, h)) {
          bestNode = n;
          bestDist = d;
        }
      }
    }
    if (bestNode) {
      const roomId = `room-node-${r}`;
      nodes.push({
        id: roomId,
        x: rx,
        y: ry,
        landmark: "room approach to review",
      });
      const isStairs = /stair|steps/i.test(bestNode.landmark || "");
      edges.push({ from: roomId, to: bestNode.id, stepFree: !isStairs });
    }
  }

  const coverage = corridorPixelCount / Math.max(1, w * h);
  const simplified = simplifyLinework(nodes, edges, 2.5);
  const lookup = new Map(simplified.nodes.map((n) => [n.id, n]));
  // Simplifying bends must not introduce a chord through a wall.
  simplified.edges = simplified.edges.filter((e) => {
    const a = lookup.get(e.from)!,
      b = lookup.get(e.to)!;
    return hasLineOfSight(a.x, a.y, b.x, b.y, wallMask, w, h);
  });
  return { ...simplified, mask: corridorMask, coverage };
}

/** Reduce sampled lines to their junctions and bends, within the given pixel tolerance. */
export function simplifyLinework(
  nodes: PathNode[],
  edges: PathEdge[],
  tolerance = 0.7,
) {
  const lookup = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map(nodes.map((n) => [n.id, [] as string[]]));
  for (const e of edges) {
    adjacency.get(e.from)?.push(e.to);
    adjacency.get(e.to)?.push(e.from);
  }
  const anchors = new Set(
    nodes.filter((n) => adjacency.get(n.id)!.length !== 2).map((n) => n.id),
  );
  const visited = new Set<string>();
  for (const n of nodes)
    if (!visited.has(n.id)) {
      const queue = [n.id];
      visited.add(n.id);
      let anchored = false;
      for (let i = 0; i < queue.length; i++) {
        anchored ||= anchors.has(queue[i]);
        for (const next of adjacency.get(queue[i])!)
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
      }
      if (!anchored) anchors.add(n.id);
    }
  const used = new Set<string>(),
    kept = new Set<string>(),
    result: PathEdge[] = [];
  const key = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  function reduce(ids: string[]): string[] {
    if (ids.length <= 2) return ids;
    const a = lookup.get(ids[0])!,
      b = lookup.get(ids[ids.length - 1])!;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy;
    let farthest = 0,
      index = 0;
    for (let i = 1; i < ids.length - 1; i++) {
      const p = lookup.get(ids[i])!,
        t = length
          ? Math.max(
              0,
              Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length),
            )
          : 0;
      const distance = Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
      if (distance > farthest) {
        farthest = distance;
        index = i;
      }
    }
    return farthest > tolerance
      ? [
          ...reduce(ids.slice(0, index + 1)).slice(0, -1),
          ...reduce(ids.slice(index)),
        ]
      : [ids[0], ids[ids.length - 1]];
  }
  for (const start of anchors)
    for (const next of adjacency.get(start)!) {
      if (used.has(key(start, next))) continue;
      const chain = [start, next];
      used.add(key(start, next));
      while (!anchors.has(chain[chain.length - 1])) {
        const current = chain[chain.length - 1],
          previous = chain[chain.length - 2];
        const following = adjacency.get(current)!.find((id) => id !== previous);
        if (!following || used.has(key(current, following))) break;
        used.add(key(current, following));
        chain.push(following);
      }
      const reduced = reduce(chain);
      for (const id of reduced) kept.add(id);
      for (let i = 1; i < reduced.length; i++)
        if (reduced[i] !== reduced[i - 1])
          result.push({
            from: reduced[i - 1],
            to: reduced[i],
            stepFree: false,
          });
    }
  return { nodes: nodes.filter((n) => kept.has(n.id)), edges: result };
}

export function categoryFor(text: string): Category {
  if (/library|biblioth|biblioteca|bücherei/i.test(text)) return "Library";
  if (
    /café|cafe|food|canteen|dining|cafeteria|coffee|bistro|grill|kitchen|bar/i.test(
      text,
    )
  )
    return "Food";
  if (/toilet|washroom|restroom|lavatory|wc\b/i.test(text)) return "Toilets";
  if (/parking|car park|garage/i.test(text)) return "Parking";
  if (
    /office|service|medical|health|dean|reception|entrance|gate|admission|cashier|registrar|financial|post office|security|student union|union|plant|center|centre|wellness|bubble|stadium|field|arena|complex|court|sports|apartments|hall|chapel|church|memorial/i.test(
      text,
    )
  )
    return "Services";
  return "Teaching";
}

export function attachPlaces(
  labels: DetectedLabel[],
  path: Pick<Linework, "nodes" | "edges">,
  width: number,
  height: number,
  canApproach?: (label: DetectedLabel, node: PathNode) => boolean,
) {
  const nodes = path.nodes.map((n) => ({ ...n })),
    places: MapPlace[] = [],
    used = new Set<string>();
  for (const label of labels) {
    let nearest: PathNode | undefined,
      dist = Infinity;
    for (const n of nodes) {
      if (used.has(n.id) || (canApproach && !canApproach(label, n))) continue;
      const d = Math.hypot(n.x - label.x, n.y - label.y);
      if (d < dist) {
        nearest = n;
        dist = d;
      }
    }
    // Approach points live ON visible linework. No geometric connector is
    // fabricated between a building's printed number and its presumed door.
    if (!nearest || dist > Math.min(width, height) * 0.16) {
      nearest = {
        id: `auto-label-${places.length}`,
        x: label.x,
        y: label.y,
        landmark: label.text,
      };
      nodes.push(nearest);
    }
    const duplicateName =
      labels.filter((l) => l.text === label.text).length > 1;
    const name = duplicateName
      ? `${label.text} (${label.number ?? places.length + 1})`
      : label.text;
    nearest.landmark = name;
    used.add(nearest.id);
    places.push({
      id: `auto-place-${places.length}`,
      nodeId: nearest.id,
      name,
      category: categoryFor(label.text),
      entrance:
        /entrance|main gate|entry|you\s*are\s*here|start|reception|lobby/i.test(
          label.text,
        ),
      labelPoint: { x: label.x, y: label.y },
      labelNumber: label.number,
      aliases: label.aliases,
      region: label.region,
      approachEstimated: path.nodes.some((n) => n.id === nearest!.id),
    });
  }
  return { nodes, edges: path.edges.map(detectedEdge), places };
}

export function assessQuality(image: PixelImage, labels: DetectedLabel[]) {
  const { data, width: w, height: h } = image;
  let white = 0,
    total = 0;
  for (let p = 0; p < w * h; p += 7) {
    total++;
    if (Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) > 235) white++;
  }
  const limited =
    labels.length < 2 || Math.min(w, h) < 480 || white / total < 0.12;
  return {
    level: limited ? ("limited" as const) : ("clear" as const),
    message: limited
      ? "Some details are a little faint. A closer, straight-on photo can help; you can also refine this draft."
      : null,
  };
}
