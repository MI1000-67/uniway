/**
 * Adapted from anti unieway/src/import/vision.mjs (MIT), © 2026 UniWay contributors.
 * Core raster vision, campus landmark directories, road network skeletonization,
 * and walkway graph topology algorithms.
 */
import type { Category } from "../../campus";
import { components } from "./components";
import { classifyMapType, analyzeFloorPlan } from "./floorplan";
import {
  paletteRegions,
  legendSwatches,
  colorDistance,
  cleanLegendName,
} from "./palette";
import type { CandidateRegion, LayoutLine } from "./types";

export { components } from "./components";

export function polylineLength(points: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  }
  return len;
}

export function skeletonize(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const output = Uint8Array.from(mask, (v) => (v ? 1 : 0));
  for (let iteration = 0; iteration < 80; iteration++) {
    let changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const remove: number[] = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const p = y * width + x;
          if (!output[p]) continue;
          const n = [
            output[p - width],
            output[p - width + 1],
            output[p + 1],
            output[p + width + 1],
            output[p + width],
            output[p + width - 1],
            output[p - 1],
            output[p - width - 1],
          ];
          const count = n.reduce((a, b) => a + b, 0);
          const transitions = n.reduce(
            (a, b, i) => a + (!b && n[(i + 1) % 8] ? 1 : 0),
            0,
          );
          if (count < 2 || count > 6 || transitions !== 1) continue;
          const first = pass ? n[0] * n[2] * n[6] : n[0] * n[2] * n[4];
          const second = pass ? n[0] * n[4] * n[6] : n[2] * n[4] * n[6];
          if (!first && !second) remove.push(p);
        }
      }
      for (const p of remove) output[p] = 0;
      changed = changed || remove.length > 0;
    }
    if (!changed) break;
  }
  return output;
}

export function simplify(
  points: { x: number; y: number }[],
  tolerance = 4,
): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  const a = points[0],
    b = points[points.length - 1],
    dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy);
  let farthest = 0,
    index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = length
      ? Math.abs(dy * points[i].x - dx * points[i].y + b.x * a.y - b.y * a.x) /
        length
      : Math.hypot(points[i].x - a.x, points[i].y - a.y);
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  }
  return farthest > tolerance
    ? [
        ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplify(points.slice(index), tolerance),
      ]
    : [a, b];
}

export type VisionJunction = {
  id: string;
  x: number;
  y: number;
  floor: number;
  name: string;
  category: Category;
  icon: string;
  description: string;
};

export type VisionEdge = {
  a: string;
  b: string;
  points: { x: number; y: number }[];
  accessible: boolean;
  confirmed: boolean;
  source: string;
  type?: string;
};

export type VisionPlace = {
  id: string;
  name: string;
  x: number;
  y: number;
  floor: number;
  confidence: number;
  description: string;
  category: Category;
  icon: string;
  number?: string;
  aliases?: string[];
  source?: "legend" | "label";
};

export function traceGraph(
  mask: Uint8Array,
  width: number,
  height: number,
  toPoint: (x: number, y: number) => { x: number; y: number },
  floor = 0,
): { junctions: VisionJunction[]; edges: VisionEdge[] } {
  const neighbors = (p: number) => {
    const x = p % width,
      y = Math.floor(p / width),
      result: number[] = [];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height)
        continue;
      const n = p + dx + dy * width;
      if (mask[n] && !(dx && dy && (mask[p + dx] || mask[p + dy * width])))
        result.push(n);
    }
    return result;
  };

  const special = new Uint8Array(mask.length);
  for (let p = 0; p < mask.length; p++)
    if (mask[p] && neighbors(p).length !== 2) special[p] = 1;

  for (const c of components(mask, width, height)) {
    if (!c.pixels.some((p) => special[p])) {
      special[c.pixels[0]] = 1;
      special[c.pixels[Math.floor(c.pixels.length / 2)]] = 1;
    }
  }

  const nodeAt = new Map<number, string>(),
    junctions: VisionJunction[] = [];
  for (const c of components(special, width, height)) {
    const id = `f${floor}-j${junctions.length}`;
    const center = c.pixels.reduce(
      (s, p) => ({ x: s.x + (p % width), y: s.y + Math.floor(p / width) }),
      { x: 0, y: 0 },
    );
    junctions.push({
      id,
      ...toPoint(center.x / c.pixels.length, center.y / c.pixels.length),
      name: "Path junction",
      category: "Services",
      icon: "pin",
      description: "",
      floor,
    });
    for (const p of c.pixels) nodeAt.set(p, id);
  }

  const visited = new Set<string>(),
    edges: VisionEdge[] = [],
    byId = new Map(junctions.map((j) => [j.id, j]));
  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

  for (const [p, from] of nodeAt) {
    for (const next of neighbors(p)) {
      if (nodeAt.get(next) === from || visited.has(key(p, next))) continue;
      let previous = p,
        current = next,
        pts: { x: number; y: number }[] = [byId.get(from)!];
      visited.add(key(previous, current));
      for (let count = 0; count < mask.length; count++) {
        const to = nodeAt.get(current);
        if (to) {
          if (to !== from) {
            pts.push(byId.get(to)!);
            const simple = simplify(pts);
            if (polylineLength(simple) > 3) {
              edges.push({
                a: from,
                b: to,
                points: simple.map((q) => ({ x: q.x, y: q.y })),
                accessible: false,
                confirmed: false,
                source: "detected",
              });
            }
          }
          break;
        }
        pts.push(toPoint(current % width, Math.floor(current / width)));
        const following = neighbors(current).find(
          (n) => n !== previous && !visited.has(key(current, n)),
        );
        if (following === undefined) break;
        previous = current;
        current = following;
        visited.add(key(previous, current));
      }
    }
  }

  return { junctions, edges };
}

export function connectPlace(
  place: { id: string; x: number; y: number; name?: string },
  graph: { junctions: VisionJunction[]; edges: VisionEdge[] },
  floor = 0,
): boolean {
  let nearestEdge: VisionEdge | null = null;
  let nearestEdgeIndex = -1;
  let nearestSegment = -1;
  let nearestPoint: { x: number; y: number } | null = null;
  let distance = Infinity;

  for (let edgeIndex = 0; edgeIndex < graph.edges.length; edgeIndex++) {
    const edge = graph.edges[edgeIndex];
    const points = edge.points;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        dx = b.x - a.x,
        dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((place.x - a.x) * dx + (place.y - a.y) * dy) /
            (dx * dx + dy * dy || 1),
        ),
      );
      const point = { x: a.x + t * dx, y: a.y + t * dy },
        d = Math.hypot(point.x - place.x, point.y - place.y);
      if (d < distance) {
        distance = d;
        nearestEdge = edge;
        nearestEdgeIndex = edgeIndex;
        nearestSegment = i;
        nearestPoint = point;
      }
    }
  }

  // Also check direct distance to existing junctions
  let nearestJunction: VisionJunction | null = null;
  let junctionDistance = Infinity;
  for (const j of graph.junctions) {
    const d = Math.hypot(j.x - place.x, j.y - place.y);
    if (d < junctionDistance) {
      junctionDistance = d;
      nearestJunction = j;
    }
  }

  const maxDist = 320;
  if (nearestEdge && nearestPoint && distance <= maxDist) {
    const targetPoint = nearestPoint;
    const close = graph.junctions.find(
      (j) => Math.hypot(j.x - targetPoint.x, j.y - targetPoint.y) < 2,
    );
    let id = close?.id;
    if (!id) {
      id = `f${floor}-j${graph.junctions.length}`;
      graph.junctions.push({
        id,
        x: targetPoint.x,
        y: targetPoint.y,
        floor,
        name: "Path junction",
        category: "Services",
        icon: "pin",
        description: "",
      });
      graph.edges.splice(
        nearestEdgeIndex,
        1,
        {
          ...nearestEdge,
          b: id,
          points: [...nearestEdge.points.slice(0, nearestSegment), targetPoint],
        },
        {
          ...nearestEdge,
          a: id,
          points: [targetPoint, ...nearestEdge.points.slice(nearestSegment)],
        },
      );
    }
    graph.edges.push({
      a: place.id,
      b: id,
      points: [{ x: place.x, y: place.y }, targetPoint],
      accessible: false,
      confirmed: false,
      source: "detected",
    });
    return true;
  } else if (nearestJunction && junctionDistance <= 450) {
    graph.edges.push({
      a: place.id,
      b: nearestJunction.id,
      points: [
        { x: place.x, y: place.y },
        { x: nearestJunction.x, y: nearestJunction.y },
      ],
      accessible: false,
      confirmed: false,
      source: "detected",
    });
    return true;
  }
  return false;
}

export function categoryForName(name: string): {
  category: Category;
  icon: string;
} {
  if (/library|biblioth|biblioteca|bücherei/i.test(name))
    return { category: "Library", icon: "book" };
  if (/café|cafe|coffee|canteen|food|dining|bistro|kitchen|bar/i.test(name))
    return { category: "Food", icon: "food" };
  if (/toilet|restroom|washroom|lavatory|wc\b/i.test(name))
    return { category: "Toilets", icon: "toilet" };
  if (/parking|car park|garage/i.test(name))
    return { category: "Parking", icon: "car" };
  if (/arena|field|bubble|stadium|court|gym|sports/i.test(name))
    return { category: "Services", icon: "ball" };
  if (
    /union|chapel|hall|apartments|center|centre|office|auditorium|museum|service|medical|health|dean|reception|gate|entrance/i.test(
      name,
    )
  )
    return { category: "Services", icon: "people" };
  return { category: "Teaching", icon: "pin" };
}

export type RasterInput = {
  pixels: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  lines?: any[];
  floor?: number;
  name?: string;
  letterbox?: boolean;
};

export type RasterResult = {
  title?: string;
  places: VisionPlace[];
  junctions: VisionJunction[];
  edges: VisionEdge[];
  buildings: {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
  }[];
  roads: { x: number; y: number }[][];
  warnings: string[];
  unplacedLabels: {
    name: string;
    confidence: number;
    color?: string;
    reason?: string;
  }[];
  reviewed: boolean;
  layoutKind: "campus" | "floorplan";
};

export function analyzeRaster({
  pixels,
  width,
  height,
  lines: rawLines = [],
  floor = 0,
  name = "",
  letterbox = false,
}: RasterInput): RasterResult {
  if (
    width < 10 ||
    height < 10 ||
    width > 2048 ||
    height > 2048 ||
    pixels.length !== width * height * 4
  ) {
    throw new Error("Invalid map pixels.");
  }

  const scale = letterbox ? Math.min(1000 / width, 800 / height) : 1;
  const offsetX = letterbox ? (1000 - width * scale) / 2 : 0;
  const offsetY = letterbox ? (800 - height * scale) / 2 : 0;
  const toPoint = (x: number, y: number) => ({
    x: offsetX + x * scale,
    y: offsetY + y * scale,
  });
  const rect = (c: {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
  }) => ({
    ...toPoint(c.x, c.y),
    width: c.width * scale,
    height: c.height * scale,
    color: c.color,
  });

  const imgData = new Uint8ClampedArray(
    pixels.buffer,
    pixels.byteOffset,
    pixels.byteLength,
  );
  const pixelImage = { data: imgData, width, height };

  // Normalize OCR lines, rejecting invalid geometry
  const lines: LayoutLine[] = rawLines.flatMap((rawL: any, id) => {
    const bbox = rawL.bbox;
    const x0 = rawL.x ?? bbox?.x0 ?? 0;
    const y0 = rawL.y ?? bbox?.y0 ?? 0;
    const x1 = rawL.width !== undefined ? x0 + rawL.width : (bbox?.x1 ?? 0);
    const y1 = rawL.height !== undefined ? y0 + rawL.height : (bbox?.y1 ?? 0);
    if (
      !Number.isFinite(x0) ||
      !Number.isFinite(y0) ||
      !Number.isFinite(x1) ||
      !Number.isFinite(y1)
    )
      return [];
    if (x1 <= x0 || y1 <= y0 || x0 < 0 || y0 < 0 || x1 > width || y1 > height)
      return [];
    if ((rawL.confidence ?? 80) < 35 || typeof rawL.text !== "string")
      return [];
    const text = rawL.text
      .normalize("NFC")
      .replace(/[|_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text.length > 240) return [];
    const w = x1 - x0;
    const h = y1 - y0;
    return [
      {
        id,
        text,
        confidence: Math.min(100, rawL.confidence ?? 80),
        x: x0,
        y: y0,
        width: w,
        height: h,
        cx: x0 + w / 2,
        cy: y0 + h / 2,
      },
    ];
  });

  const regions = paletteRegions(pixelImage);
  const swatches = legendSwatches(regions, width, height);

  // Check if classified as indoor floorplan
  if (classifyMapType(pixelImage, lines, swatches.length) === "floorplan") {
    const fp = analyzeFloorPlan(pixelImage, lines);
    const places = fp.labels.map((l, i) => {
      const { category, icon } = categoryForName(l.text);
      return {
        id: `f${floor}-p${i}`,
        name: l.text,
        ...toPoint(l.x, l.y),
        floor,
        confidence: l.confidence,
        description: "Room from floor plan layout.",
        category,
        icon,
        source: l.source,
      };
    });
    return {
      title: name ? name.replace(/\.[^.]+$/, "") : "Floor Plan",
      places,
      junctions: [],
      edges: [],
      buildings: fp.candidateRegions.map(rect),
      roads: [],
      warnings: fp.warnings,
      unplacedLabels: [],
      reviewed: false,
      layoutKind: "floorplan",
    };
  }

  // Detect directory / legend at the bottom
  const bottomLines = lines.filter((l) => l.y > height * 0.65);
  const hasBottomDirectory =
    bottomLines.length >= 4 &&
    bottomLines.some((l) =>
      /^\s*\d{1,2}[\.\s\-]|location key|legend|key\b/i.test(l.text || ""),
    );
  const legendTopY = hasBottomDirectory
    ? Math.min(...bottomLines.map((l) => l.y)) - 8
    : Infinity;

  const inLegend = (x: number, y: number) =>
    y >= legendTopY ||
    swatches.some(
      (c) =>
        Math.abs(y - c.y - c.height / 2) < Math.max(c.height * 1.8, 10) &&
        x >= c.x - 5,
    );

  const swatchSet = new Set(swatches);
  const buildingRegions = regions.filter((c) => {
    if (swatchSet.has(c) || c.border) return false;
    if (c.pixels.length < Math.max(8, width * height * 0.000025)) return false;
    if (c.width >= width * 0.6 || c.height >= height * 0.6) return false;
    if (
      c.y + c.height < height * 0.14 &&
      c.pixels.length < width * height * 0.008
    )
      return false;
    if (inLegend(c.x + c.width / 2, c.y + c.height / 2)) return false;
    if (c.width > c.height * 7 || c.height > c.width * 7) return false;
    if (
      lines.some(
        (l) =>
          (l.y < height * 0.14 || inLegend(l.x, l.y)) &&
          c.x <= l.x + l.width &&
          l.x <= c.x + c.width &&
          c.y <= l.y + l.height &&
          l.y <= c.y + c.height,
      )
    )
      return false;
    return true;
  });

  const allCleanLines = lines.filter(
    (l) => l.confidence >= 35 && l.text.length > 0,
  );
  const normalized = allCleanLines.filter(
    (l) => l.confidence >= 45 && /[A-Za-z]{3}/.test(l.text),
  );

  let title = normalized.find(
    (l) => l.y < height * 0.15 && /university|campus|faculty/i.test(l.text),
  )?.text;
  if (title && /university of$/i.test(title.trim())) {
    const nextWord = normalized.find(
      (l) =>
        l.y < height * 0.15 && l.text !== title && /^[A-Z]{3,}/.test(l.text),
    );
    if (nextWord)
      title = `${title} ${nextWord.text.charAt(0) + nextWord.text.slice(1).toLowerCase()}`;
  }

  const places: VisionPlace[] = [],
    unplacedLabels: {
      name: string;
      confidence: number;
      color?: string;
      reason?: string;
    }[] = [],
    usedLines = new Set<LayoutLine>(),
    usedBuildings = new Set<any>();

  const addPlace = (
    name: string,
    x: number,
    y: number,
    confidence: number,
    description?: string,
    number?: string,
    source: "legend" | "label" = "legend",
  ) => {
    const pt = toPoint(x, y);
    if (
      name.length < 2 ||
      name.length > 100 ||
      places.length >= 500 ||
      places.some(
        (p) => p.name === name && Math.hypot(p.x - pt.x, p.y - pt.y) < 20,
      )
    )
      return;
    const { category, icon } = categoryForName(name);
    places.push({
      id: `f${floor}-p${places.length}`,
      name,
      x: pt.x,
      y: pt.y,
      category,
      icon,
      floor,
      confidence,
      description:
        description ||
        "Read from your layout. Check the label and entrance before following directions.",
      number,
      source,
    });
  };

  // Swatch-based legend matching
  for (const swatch of swatches) {
    const cy = swatch.y + swatch.height / 2;
    const line = normalized
      .filter(
        (l) =>
          l.text !== title &&
          !usedLines.has(l) &&
          l.x + l.width > swatch.x + swatch.width &&
          Math.abs(l.cy - cy) < Math.max(swatch.height * 1.2, l.height),
      )
      .sort((a, b) => Math.abs(a.cy - cy) - Math.abs(b.cy - cy))[0];
    if (!line) continue;
    usedLines.add(line);
    const placeName = cleanLegendName(line.text);
    const candidates = buildingRegions
      .filter(
        (c) =>
          c.pixels.length > swatch.pixels.length * 0.25 &&
          !usedBuildings.has(c) &&
          !inLegend(c.x + c.width / 2, c.y + c.height / 2),
      )
      .map((c) => ({ c, d: colorDistance(c.rgb, swatch.rgb) }))
      .filter((v) => v.d < 95)
      .sort((a, b) => a.d - b.d);
    if (
      swatches.some(
        (other) =>
          other !== swatch && colorDistance(other.rgb, swatch.rgb) < 18,
      ) ||
      !candidates.length ||
      (candidates.length > 1 && candidates[1].d - candidates[0].d < 8)
    ) {
      unplacedLabels.push({
        name: placeName,
        confidence: line.confidence,
        color: swatch.color,
        reason: "ambiguous-color",
      });
      continue;
    }
    const target = candidates[0].c;
    usedBuildings.add(target);
    addPlace(
      placeName,
      target.x + target.width / 2,
      target.y + target.height / 2,
      line.confidence,
      "Matched from the colour legend. Move the pin to the real entrance before connecting a path.",
      undefined,
      "legend",
    );
  }

  {
    // Universal Directory & Number-Key Matching (Unicode-aware: Tamil, Sinhala, Hindi, Arabic, Latin, etc.)
    const DIR_ENTRY_REGEX =
      /^\s*[\[(]?\s*(\d{1,3}[A-Za-z]?|[A-Za-z]{1,2}\d{1,3}|[A-Za-z])\s*[\]).:\-–\s]\s*(\p{L}.+)$/u;
    const MAP_MARKER_REGEX =
      /^\s*[\[(]?\s*(\d{1,3}[A-Za-z]?|[A-Za-z]{1,2}\d{1,3}|[A-Za-z])\s*[\]).:]?\s*$/u;

    const directoryEntries: {
      key: string;
      label: string;
      rawLine: LayoutLine;
      confidence: number;
    }[] = [];
    for (const l of allCleanLines) {
      if (usedLines.has(l) || l.text === title) continue;
      const m = l.text.match(DIR_ENTRY_REGEX);
      if (m) {
        const key = m[1].toUpperCase();
        const label = m[2].trim();
        if (
          !/\b(road|mawatha|avenue|street|drive|way|path|scale|metres|meters|north|copyright|legend)\b/i.test(
            label,
          ) &&
          label.length >= 2
        ) {
          directoryEntries.push({
            key,
            label,
            rawLine: l,
            confidence: l.confidence ?? 80,
          });
        }
      }
    }

    const inDirectoryArea = (x: number, y: number) =>
      inLegend(x, y) ||
      directoryEntries.some(
        (d) =>
          x >= d.rawLine.x - 5 &&
          x <= d.rawLine.x + d.rawLine.width + 5 &&
          y >= d.rawLine.y - 4 &&
          y <= d.rawLine.y + d.rawLine.height + 4,
      );

    const mapMarkers: {
      key: string;
      line: LayoutLine;
      x: number;
      y: number;
      confidence: number;
    }[] = [];
    for (const l of allCleanLines) {
      if (usedLines.has(l) || l.text === title) continue;
      if (inDirectoryArea(l.cx, l.cy) || l.cy < height * 0.12) continue;
      const m = l.text.match(MAP_MARKER_REGEX);
      if (m) {
        mapMarkers.push({
          key: m[1].toUpperCase(),
          line: l,
          x: l.cx,
          y: l.cy,
          confidence: l.confidence ?? 80,
        });
      }
    }

    if (directoryEntries.length > 0) {
      const usedMarkers = new Set<any>();
      for (const entry of directoryEntries) {
        usedLines.add(entry.rawLine);
        const duplicateEntries = directoryEntries.filter(
          (other) => other.key === entry.key && other.label !== entry.label,
        );
        const matchingMarkers = mapMarkers.filter((m) => m.key === entry.key);

        if (duplicateEntries.length > 0 || matchingMarkers.length > 1) {
          unplacedLabels.push({
            name: entry.label,
            confidence: entry.confidence,
            reason: "ambiguous-key",
          });
          continue;
        }

        const matchingMarker = matchingMarkers.find((m) => !usedMarkers.has(m));
        if (matchingMarker) {
          usedMarkers.add(matchingMarker);
          usedLines.add(matchingMarker.line);

          addPlace(
            entry.label,
            matchingMarker.x,
            matchingMarker.y,
            Math.round((entry.confidence + matchingMarker.confidence) / 2),
            `Matched from campus directory key ${entry.key}.`,
            entry.key,
            "legend",
          );
        } else {
          if (!unplacedLabels.some((u) => u.name === entry.label)) {
            unplacedLabels.push({
              name: entry.label,
              confidence: entry.confidence,
              color: "#244e43",
              reason: "missing-marker",
            });
          }
        }
      }
    }

    // Direct text-label matching on map surface for buildings with printed names
    const useful =
      /library|lecture|caf[eé]|canteen|entrance|student|department|faculty|laboratory|auditorium|health|garden|sport|hall|office|room|centre|center|complex/i;
    for (const line of normalized) {
      const x = line.cx,
        y = line.cy;
      if (
        usedLines.has(line) ||
        line.text === title ||
        inLegend(x, y) ||
        inDirectoryArea(x, y) ||
        line.confidence < 65 ||
        !useful.test(line.text) ||
        /\b(road|path|walk|corridor|legend|scale|north|copyright|metres|meters)\b/i.test(
          line.text,
        ) ||
        line.text.split(" ").length > 10
      )
        continue;
      if (
        [...usedBuildings].some(
          (c) =>
            x >= c.x - 3 &&
            x <= c.x + c.width + 3 &&
            y >= c.y - 3 &&
            y <= c.y + c.height + 3,
        )
      )
        continue;
      addPlace(line.text, x, y, line.confidence, undefined, undefined, "label");
    }
  }

  // Road band extraction
  const gray = new Uint8Array(width * height);
  const margin = Math.max(3, Math.round(Math.min(width, height) * 0.025));
  for (let y = margin; y < height - margin; y++) {
    for (let x = margin; x < width - margin; x++) {
      const i = y * width + x,
        r = pixels[i * 4],
        g = pixels[i * 4 + 1],
        b = pixels[i * 4 + 2];
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        diff = max - min;
      const isGrey = diff < 18 && min > 110 && max < 225;
      const isTan =
        diff >= 15 &&
        diff < 65 &&
        r >= g &&
        g >= b &&
        r > 150 &&
        r < 235 &&
        b > 105;
      if (
        (isGrey || isTan) &&
        !inLegend(x, y) &&
        !swatches.some((c) => c.x > width * 0.55 && x >= c.x - 5)
      )
        gray[i] = 1;
    }
  }

  for (const l of lines) {
    for (
      let y = Math.max(0, Math.floor(l.y - 2));
      y < Math.min(height, l.y + l.height + 2);
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(l.x - 2));
        x < Math.min(width, l.x + l.width + 2);
        x++
      ) {
        gray[y * width + x] = 0;
      }
    }
  }

  const roadMask = new Uint8Array(gray.length);
  for (const c of components(gray, width, height)) {
    if (
      c.x <= margin ||
      c.y <= margin ||
      c.x + c.width >= width - margin ||
      c.y + c.height >= height - margin ||
      c.pixels.length < 50
    )
      continue;
    let interior = 0;
    for (const i of c.pixels) {
      if (
        gray[i - 1] &&
        gray[i + 1] &&
        gray[i - width] &&
        gray[i + width] &&
        gray[i - 2] &&
        gray[i + 2] &&
        gray[i - 2 * width] &&
        gray[i + 2 * width]
      )
        interior++;
    }
    const elongated = Math.max(c.width / c.height, c.height / c.width) > 2.2;
    const isNetwork =
      c.pixels.length > 120 && interior / c.pixels.length > 0.08;
    if (
      (interior / c.pixels.length >= 0.12 && isNetwork) ||
      (interior / c.pixels.length >= 0.16 && elongated)
    ) {
      for (const i of c.pixels) roadMask[i] = 1;
    }
  }

  const graph = traceGraph(
    skeletonize(roadMask, width, height),
    width,
    height,
    toPoint,
    floor,
  );
  if (graph.edges.length > 180) {
    graph.edges = graph.edges
      .filter((e) => polylineLength(e.points) > 12)
      .slice(0, 160);
    const activeIds = new Set(graph.edges.flatMap((e) => [e.a, e.b]));
    graph.junctions = graph.junctions.filter((j) => activeIds.has(j.id));
  }

  for (const place of places) {
    connectPlace(place, graph, floor);
  }

  const warnings: string[] = [];
  if (!places.length)
    warnings.push(
      "No reliable destination positions were found. Keep the source visible and place labels where they belong.",
    );
  if (unplacedLabels.length)
    warnings.push(
      "Some legend colours are ambiguous. Review any labels still waiting for placement.",
    );
  if (!graph.edges.length)
    warnings.push(
      "No distinct path network could be verified from the image. Trace the walkways on the original layout to enable routes.",
    );
  else
    warnings.push(
      "Path candidates need review. Check every segment and entrance before using directions.",
    );
  if (places.length)
    warnings.push(
      "Check that each destination has a traced connection to the walkway network.",
    );
  warnings.push("Distances and geographic north are not calibrated.");

  return {
    title,
    places,
    junctions: graph.junctions,
    edges: graph.edges,
    buildings: buildingRegions.map(rect),
    roads: graph.edges.map((e) => e.points),
    warnings,
    unplacedLabels,
    reviewed: false,
    layoutKind: "campus",
  };
}
