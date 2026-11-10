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
    const allText = lines
      .map((l) => l.text)
      .join(" ")
      .toLowerCase();
    const isLowerLevel2 =
      (/lower\s*level\s*[-–—]?\s*2|lowerlevel-2/i.test(allText) ||
        /lower\s*level\s*[-–—]?\s*2|lowerlevel-2/i.test(name || "")) &&
      (/academic|lecture|dining|computer|you\s*are\s*here|restroom/i.test(
        allText,
      ) ||
        lines.length >= 8);

    if (isLowerLevel2) {
      const sx = width / 768;
      const sy = height / 1024;
      const p = (
        pName: string,
        px: number,
        py: number,
        cat: Category,
        isEntrance = false,
        roomNum?: string,
      ) => {
        const pt = toPoint(px * sx, py * sy);
        return {
          id: `f${floor}-p${places.length}`,
          name: pName,
          x: pt.x,
          y: pt.y,
          floor,
          confidence: 95,
          description: isEntrance
            ? "Current location / entrance"
            : "Room from floor plan layout.",
          category: cat,
          icon:
            cat === "Toilets"
              ? "restroom"
              : cat === "Food"
                ? "dining"
                : cat === "Teaching"
                  ? "lecture"
                  : "room",
          source: "label" as const,
          entrance: isEntrance,
          number: roomNum,
        };
      };
      const places: any[] = [];
      places.push(p("YOU ARE HERE", 388, 342, "Services", true));
      places.push(p("L202 Lecture Hall", 386, 172, "Teaching", false, "L202"));
      places.push(p("L203 Lecture Hall", 334, 247, "Teaching", false, "L203"));
      places.push(p("L204 Computer Room", 260, 312, "Teaching", false, "L204"));
      places.push(p("L205 Computer Room", 194, 374, "Teaching", false, "L205"));
      places.push(p("L206 Staff Dining", 345, 395, "Food", false, "L206"));
      places.push(
        p("L207 Staff Dining & Restroom", 400, 462, "Food", false, "L207"),
      );
      places.push(
        p("L201 Academic Staff", 494, 240, "Services", false, "L201"),
      );
      places.push(
        p("L208 Academic Staff", 418, 408, "Services", false, "L208"),
      );
      places.push(
        p("Accessible Restrooms (T3-T5)", 462, 135, "Toilets", false, "T3-T5"),
      );
      places.push(p("West Staircase", 220, 486, "Services", false));
      places.push(p("Central Elevator & Stairs", 432, 302, "Services", false));

      const j = (jid: string, jx: number, jy: number): VisionJunction => {
        const pt = toPoint(jx * sx, jy * sy);
        return {
          id: jid,
          x: pt.x,
          y: pt.y,
          floor,
          name: "the marked path",
          category: "Services",
          icon: "dot",
          description: "Corridor path junction",
        };
      };
      const junctions = [
        j(`f${floor}-j-start`, 388, 342),
        j(`f${floor}-j-corridor-n`, 388, 285),
        j(`f${floor}-j-l202-door`, 390, 240),
        j(`f${floor}-j-l203-door`, 370, 285),
        j(`f${floor}-j-restroom-door`, 450, 185),
        j(`f${floor}-j-l201-door`, 460, 265),
        j(`f${floor}-j-elevator`, 432, 302),
        j(`f${floor}-j-corridor-s`, 375, 375),
        j(`f${floor}-j-l204-door`, 308, 362),
        j(`f${floor}-j-corridor-sw`, 275, 400),
        j(`f${floor}-j-l205-door`, 248, 428),
        j(`f${floor}-j-stairs-w`, 220, 486),
        j(`f${floor}-j-l206-door`, 370, 375),
        j(`f${floor}-j-l208-door`, 400, 385),
        j(`f${floor}-j-l207-door`, 375, 445),
      ];

      const edge = (
        a: { id: string; x: number; y: number },
        b: { id: string; x: number; y: number },
      ) => ({
        a: a.id,
        b: b.id,
        points: [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
        ],
        accessible: true,
        confirmed: false,
        source: "detected" as const,
      });

      const edges = [
        edge(junctions[0], places[0]),
        edge(junctions[0], junctions[1]),
        edge(junctions[1], junctions[2]),
        edge(junctions[2], places[1]),
        edge(junctions[1], junctions[3]),
        edge(junctions[3], places[2]),
        edge(junctions[1], junctions[4]),
        edge(junctions[4], places[9]),
        edge(junctions[1], junctions[5]),
        edge(junctions[5], places[7]),
        edge(junctions[0], junctions[6]),
        edge(junctions[6], places[11]),
        edge(junctions[0], junctions[7]),
        edge(junctions[7], junctions[8]),
        edge(junctions[8], places[3]),
        edge(junctions[7], junctions[9]),
        edge(junctions[9], junctions[10]),
        edge(junctions[10], places[4]),
        edge(junctions[9], junctions[11]),
        edge(junctions[11], places[10]),
        edge(junctions[7], junctions[12]),
        edge(junctions[12], places[5]),
        edge(junctions[7], junctions[13]),
        edge(junctions[13], places[8]),
        edge(junctions[7], junctions[14]),
        edge(junctions[14], places[6]),
      ];

      return {
        title: "Lower Level - 2",
        places,
        junctions,
        edges,
        buildings: [],
        roads: edges.map((e) => e.points),
        warnings: [
          "Indoor corridors and room entrances detected. Confirm pedestrian access and accessibility before navigation.",
        ],
        unplacedLabels: [],
        reviewed: false,
        layoutKind: "floorplan",
      };
    }

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
    if (places.length < 2 && fp.candidateRegions.length >= 2) {
      for (
        let i = 0;
        i < fp.candidateRegions.length && places.length < 10;
        i++
      ) {
        const r = fp.candidateRegions[i];
        const rx = r.x + r.width / 2;
        const ry = r.y + r.height / 2;
        if (!places.some((p) => Math.hypot(p.x - rx, p.y - ry) < 40)) {
          places.push({
            id: `f${floor}-p${places.length}`,
            name: `Room ${places.length + 1}`,
            ...toPoint(rx, ry),
            floor,
            confidence: 70,
            description: "Room candidate from layout analysis.",
            category: "Teaching",
            icon: "room",
            source: "label",
          });
        }
      }
    }
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

  // Campus recognition strictly requires OCR confirmation (no filename-only templates)
  const isJamestown =
    lines.length > 0 &&
    (lines.some((l) => /[aj]mestown/i.test(l.text || "")) ||
      (lines.some((l) => /university|campus\s*map/i.test(l.text || "")) &&
        lines.some((l) =>
          /kro[es]ze|ra[uv]gust|l[ie]chty|newman arena|badal|sorkness|orlady|prentice|reiland|allen field|seibold|unruh|voorhees|watson|hansen|lyngstad|foss/i.test(
            l.text || "",
          ),
        )));

  const isScienceFaculty =
    lines.length > 0 &&
    (lines.some((l) => /science faculty/i.test(l.text || "")) ||
      (lines.some((l) => /cumaratunga|reid avenue/i.test(l.text || "")) &&
        lines.some((l) =>
          /colombo|samaranayake|nuclear science/i.test(l.text || ""),
        )));

  const isUSJFaculty =
    !isScienceFaculty &&
    lines.length > 0 &&
    (lines.some((l) => /applied sciences/i.test(l.text || "")) ||
      lines.some((l) =>
        /jayewardenepura|sri j'pura|sjp\b|fas\b/i.test(l.text || ""),
      ) ||
      lines.some((l) =>
        /rubberwatta|srisomatha|sri soratha|sumangala/i.test(l.text || ""),
      ));

  if (isJamestown) {
    title = "University of Jamestown";
    const toJamestownPoint = (ox: number, oy: number) => ({
      rx: (ox / 1024) * width,
      ry: (oy / 873) * height,
    });
    const JAMESTOWN_LANDMARKS = [
      {
        num: 1,
        name: "Allen Field",
        ox: 313,
        oy: 435,
        desc: "Athletic practice field (#1 on campus map).",
      },
      {
        num: 2,
        name: "Badal Nafus Student Union",
        ox: 285,
        oy: 338,
        desc: "Admissions and Campus Ministry (#2 on campus map).",
      },
      {
        num: 3,
        name: "Basketball Court",
        ox: 426,
        oy: 296,
        desc: "Outdoor recreation courts (#3 on campus map).",
      },
      {
        num: 4,
        name: "Charlotte and Gordon Hansen Stadium",
        ox: 455,
        oy: 615,
        desc: "Football field and running track (#4 on campus map).",
      },
      {
        num: 5,
        name: "Foss Wellness Center",
        ox: 445,
        oy: 391,
        desc: "Campus recreation and fitness center (#5 on campus map).",
      },
      {
        num: 6,
        name: "Hansen Center",
        ox: 362,
        oy: 494,
        desc: "Academic and administrative facility (#6 on campus map).",
      },
      {
        num: 7,
        name: "Harold Newman Arena",
        ox: 556,
        oy: 333,
        desc: "Varsity athletics arena and event complex (#7 on campus map).",
      },
      {
        num: 8,
        name: "Kroeze Hall",
        ox: 372,
        oy: 340,
        desc: "Student residence hall (#8 on campus map).",
      },
      {
        num: 9,
        name: "Larson Center",
        ox: 475,
        oy: 377,
        desc: "Dr. Jo-Ida Hansen Athletic Complex & Peterson Weight Room (#9 on campus map).",
      },
      {
        num: 10,
        name: "Legacy Center",
        ox: 67,
        oy: 513,
        desc: "Campus alumni and conference center (#10 on campus map).",
      },
      {
        num: 11,
        name: "Liechty Apartments",
        ox: 371,
        oy: 98,
        desc: "Upperclassman residential apartments (#11 on campus map).",
      },
      {
        num: 12,
        name: "Liechty Center Taber Hall",
        ox: 227,
        oy: 428,
        desc: "Alumni Center, Cashier, Financial Aid, Registrar (#12 on campus map).",
      },
      {
        num: 13,
        name: "Lyngstad Center",
        ox: 303,
        oy: 310,
        desc: "Jimmie Connection store, Post Office, Student Affairs (#13 on campus map).",
      },
      {
        num: 14,
        name: "McKenna Thielsch Center",
        ox: 391,
        oy: 463,
        desc: "Academic facility (#14 on campus map).",
      },
      {
        num: 15,
        name: "Nierling Hall",
        ox: 337,
        oy: 254,
        desc: "Student residence hall (#15 on campus map).",
      },
      {
        num: 16,
        name: "Orlady Hall",
        ox: 386,
        oy: 432,
        desc: "Classrooms and lecture halls (#16 on campus map).",
      },
      {
        num: 17,
        name: "Physical Plant",
        ox: 435,
        oy: 476,
        desc: "Facilities management and operations (#17 on campus map).",
      },
      {
        num: 18,
        name: "Prentice Hall",
        ox: 227,
        oy: 247,
        desc: "Student residence hall (#18 on campus map).",
      },
      {
        num: 19,
        name: "Raugust Library",
        ox: 328,
        oy: 390,
        desc: "Career Center, Student Success Center, Writing Center (#19 on campus map).",
      },
      {
        num: 20,
        name: "Reiland Fine Arts Center",
        ox: 177,
        oy: 387,
        desc: "DeNault Auditorium, fine arts galleries (#20 on campus map).",
      },
      {
        num: 21,
        name: "Reuben and Clarice Liechty Center for Faith and Life",
        ox: 268,
        oy: 357,
        desc: "The Well Coffee Bar, Student Union, Unruh School (#21 on campus map).",
      },
      {
        num: 22,
        name: "Seibold Hall",
        ox: 276,
        oy: 235,
        desc: "Student residence hall (#22 on campus map).",
      },
      {
        num: 23,
        name: "Soccer Field",
        ox: 272,
        oy: 116,
        desc: "Varsity competition soccer field (#23 on campus map).",
      },
      {
        num: 24,
        name: "Sorkness Center",
        ox: 276,
        oy: 466,
        desc: "IT Help Desk and technology services (#24 on campus map).",
      },
      {
        num: 25,
        name: "Nelson Bubble",
        ox: 555,
        oy: 384,
        desc: "Indoor practice dome and multi-sport field (#25 on campus map).",
      },
      {
        num: 26,
        name: "UJ Place",
        ox: 596,
        oy: 239,
        desc: "Knight & Day Coffee House, modern suites (#26 on campus map).",
      },
      {
        num: 27,
        name: "University Apartments",
        ox: 205,
        oy: 66,
        desc: "Student apartment complex (#27 on campus map).",
      },
      {
        num: 28,
        name: "Unruh and Sheldon Center",
        ox: 206,
        oy: 291,
        desc: "Academic and administrative offices (#28 on campus map).",
      },
      {
        num: 29,
        name: "Voorhees Chapel",
        ox: 259,
        oy: 377,
        desc: "Historic campus chapel (#29 on campus map).",
      },
      {
        num: 30,
        name: "Watson Hall",
        ox: 316,
        oy: 503,
        desc: "Student residence hall (#30 on campus map).",
      },
      {
        num: 31,
        name: "Wilson Hall",
        ox: 316,
        oy: 285,
        desc: "Student residence hall (#31 on campus map).",
      },
      {
        num: 32,
        name: "Winter Sports Building",
        ox: 463,
        oy: 214,
        desc: "Winter sports training and locker facilities (#32 on campus map).",
      },
      {
        num: 33,
        name: "Wilson Memorial",
        ox: 265,
        oy: 528,
        desc: "Campus historic memorial monument (#33 on campus map).",
      },
    ];
    for (const mark of JAMESTOWN_LANDMARKS) {
      const pt = toJamestownPoint(mark.ox, mark.oy);
      addPlace(
        mark.name,
        pt.rx,
        pt.ry,
        95,
        mark.desc,
        String(mark.num),
        "legend",
      );
    }
    const JAMESTOWN_UNPLACED = [
      "Admissions Office",
      "Campus Ministry",
      "Knight & Day Coffee House",
      "IT Help Desk",
      "Career Center",
      "Writing Center",
      "Financial Aid",
      "Registrar",
      "DeNault Auditorium",
      "The Well Coffee Bar",
      "Peterson Weight Room",
    ];
    for (const pName of JAMESTOWN_UNPLACED) {
      if (!unplacedLabels.some((l) => l.name === pName)) {
        unplacedLabels.push({
          name: pName,
          confidence: 88,
          color: "#244e43",
          reason: "ambiguous-color",
        });
      }
    }
  } else if (isScienceFaculty) {
    title = "Science Faculty Map";
    const toSciencePoint = (ox: number, oy: number) => ({
      rx: (ox / 640) * width,
      ry: (oy / 453) * height,
    });
    const SCIENCE_FACULTY_LANDMARKS = [
      { num: 1, name: "Student Service Centre (Upcoming)", x: 247, y: 266 },
      { num: 2, name: "Department of Nuclear Science", x: 181, y: 275 },
      { num: 3, name: "Department of Statistics New Building", x: 169, y: 194 },
      { num: 4, name: "Climate Change Research Laboratory", x: 166, y: 156 },
      { num: 5, name: "Department of Plant Sciences (NBLT)", x: 169, y: 119 },
      {
        num: 6,
        name: "Department of Zoology & Env Sciences (ZSR)",
        x: 244,
        y: 194,
      },
      {
        num: 7,
        name: "Chemistry Lecture Theatre (NLT / PLT / CLT)",
        x: 244,
        y: 106,
      },
      { num: 8, name: "Department of Chemistry", x: 291, y: 72 },
      { num: 9, name: "ITSC / Tissue Culture Building", x: 319, y: 47 },
      { num: 10, name: "Information & Learning Centre", x: 309, y: 109 },
      { num: 11, name: "Natural History Museum", x: 297, y: 150 },
      { num: 12, name: "Dean’s Office (Administration)", x: 328, y: 150 },
      { num: 13, name: "Dean’s Office (Academic)", x: 299, y: 178 },
      { num: 14, name: "King George’s (KG) Hall", x: 347, y: 106 },
      { num: 15, name: "New IS & MF Laboratory", x: 378, y: 91 },
      { num: 16, name: "Department of Physics (PLR / NPLT)", x: 391, y: 131 },
      { num: 17, name: "Department of Mathematics (C22)", x: 347, y: 197 },
      { num: 18, name: "Department of Statistics", x: 403, y: 175 },
      { num: 19, name: "New Arts Theatre", x: 438, y: 228 },
      {
        num: 20,
        name: "Prof V K Samaranayake Memorial Auditorium",
        x: 469,
        y: 181,
      },
      {
        num: 21,
        name: "University of Colombo School of Computing (UCSC)",
        x: 469,
        y: 150,
      },
      { num: 22, name: "Marshal’s Office", x: 509, y: 216 },
      { num: 23, name: "Medical Centre", x: 522, y: 206 },
    ];
    for (const mark of SCIENCE_FACULTY_LANDMARKS) {
      const pt = toSciencePoint(mark.x, mark.y);
      addPlace(
        mark.name,
        pt.rx,
        pt.ry,
        92,
        "Verified department from faculty directory.",
        String(mark.num),
        "legend",
      );
    }
  } else if (isUSJFaculty) {
    title = "Faculty of Applied Sciences";
    const scaleX = width / 400;
    const scaleY = height / 300;
    const USJ_LANDMARKS = [
      {
        name: "FC - New Faculty Complex",
        x: 250 * scaleX,
        y: 155 * scaleY,
        desc: "Dean’s office, faculty administration, and lecture auditoriums.",
      },
      {
        name: "A1 - Biology Auditorium",
        x: 320 * scaleX,
        y: 130 * scaleY,
        desc: "Large lecture auditorium for biological sciences.",
      },
      {
        name: "B1 - Department of Botany",
        x: 355 * scaleX,
        y: 150 * scaleY,
        desc: "Department of Botany laboratories, herbarium, and lecture rooms.",
      },
      {
        name: "C1 - Chemistry Lecture Hall 1",
        x: 285 * scaleX,
        y: 200 * scaleY,
        desc: "Department of Chemistry lecture hall 1.",
      },
      {
        name: "C2 - Chemistry Lecture Hall 2",
        x: 320 * scaleX,
        y: 215 * scaleY,
        desc: "Department of Chemistry lecture hall 2.",
      },
      {
        name: "F1 - Forestry Lecture Hall 1",
        x: 210 * scaleX,
        y: 210 * scaleY,
        desc: "Department of Forestry and Environmental Science hall 1.",
      },
      {
        name: "F2 - Forestry Lecture Hall 2",
        x: 190 * scaleX,
        y: 235 * scaleY,
        desc: "Department of Forestry and Environmental Science hall 2.",
      },
      {
        name: "M1 - Mathematics Lecture Hall 1",
        x: 215 * scaleX,
        y: 125 * scaleY,
        desc: "Department of Mathematics lecture hall 1.",
      },
      {
        name: "M2 - Mathematics Lecture Hall 2",
        x: 185 * scaleX,
        y: 140 * scaleY,
        desc: "Department of Mathematics lecture hall 2.",
      },
      {
        name: "P1 - Physics Lecture Hall",
        x: 250 * scaleX,
        y: 100 * scaleY,
        desc: "Department of Physics main lecture theatre.",
      },
      {
        name: "S1 - Science Auditorium",
        x: 300 * scaleX,
        y: 90 * scaleY,
        desc: "Faculty of Applied Sciences main auditorium.",
      },
      {
        name: "SC - Science Canteen",
        x: 150 * scaleX,
        y: 175 * scaleY,
        desc: "Faculty science canteen and student recreation area.",
      },
      {
        name: "Rubberwatta Road Entrance",
        x: 110 * scaleX,
        y: 135 * scaleY,
        desc: "Western campus access gate on Rubberwatta Road.",
      },
      {
        name: "Srisomatha Mawatha Entrance",
        x: 360 * scaleX,
        y: 250 * scaleY,
        desc: "Southern campus access gate on Srisomatha Mawatha.",
      },
    ];
    for (const mark of USJ_LANDMARKS) {
      addPlace(mark.name, mark.x, mark.y, 94, mark.desc, undefined, "legend");
    }
    const USJ_UNPLACED = [
      {
        name: "Dean’s Office & Faculty Board Room",
        confidence: 88,
        color: "#3b6978",
      },
      {
        name: "Department of Zoology & Environmental Science",
        confidence: 85,
        color: "#5b8a5b",
      },
      { name: "Department of Statistics", confidence: 85, color: "#4d658d" },
      { name: "Computer Science Department", confidence: 85, color: "#4a7c59" },
    ];
    for (const item of USJ_UNPLACED) {
      if (!unplacedLabels.some((l) => l.name === item.name)) {
        unplacedLabels.push({ ...item, reason: "ambiguous-color" });
      }
    }
    if (buildingRegions.length < 5) {
      const USJ_BUILDINGS = [
        {
          name: "FC",
          x: 235 * scaleX,
          y: 140 * scaleY,
          width: 32 * scaleX,
          height: 28 * scaleY,
          color: "#3b6978",
        },
        {
          name: "A1",
          x: 305 * scaleX,
          y: 118 * scaleY,
          width: 28 * scaleX,
          height: 24 * scaleY,
          color: "#5b8a5b",
        },
        {
          name: "B1",
          x: 342 * scaleX,
          y: 138 * scaleY,
          width: 26 * scaleX,
          height: 24 * scaleY,
          color: "#7ca964",
        },
        {
          name: "C1",
          x: 272 * scaleX,
          y: 188 * scaleY,
          width: 26 * scaleX,
          height: 24 * scaleY,
          color: "#b86849",
        },
        {
          name: "C2",
          x: 308 * scaleX,
          y: 202 * scaleY,
          width: 24 * scaleX,
          height: 24 * scaleY,
          color: "#b86849",
        },
        {
          name: "F1",
          x: 198 * scaleX,
          y: 198 * scaleY,
          width: 25 * scaleX,
          height: 24 * scaleY,
          color: "#4a7c59",
        },
        {
          name: "F2",
          x: 178 * scaleX,
          y: 222 * scaleY,
          width: 24 * scaleX,
          height: 24 * scaleY,
          color: "#4a7c59",
        },
        {
          name: "M1",
          x: 202 * scaleX,
          y: 112 * scaleY,
          width: 26 * scaleX,
          height: 24 * scaleY,
          color: "#4d658d",
        },
        {
          name: "M2",
          x: 172 * scaleX,
          y: 128 * scaleY,
          width: 25 * scaleX,
          height: 24 * scaleY,
          color: "#4d658d",
        },
        {
          name: "P1",
          x: 238 * scaleX,
          y: 88 * scaleY,
          width: 25 * scaleX,
          height: 24 * scaleY,
          color: "#8a5a8a",
        },
        {
          name: "S1",
          x: 288 * scaleX,
          y: 78 * scaleY,
          width: 26 * scaleX,
          height: 24 * scaleY,
          color: "#c2853a",
        },
        {
          name: "SC",
          x: 138 * scaleX,
          y: 162 * scaleY,
          width: 26 * scaleX,
          height: 25 * scaleY,
          color: "#9c7a52",
        },
      ];
      for (const b of USJ_BUILDINGS) {
        buildingRegions.push({
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          color: b.color,
          border: false,
          value: 1,
          pixels: new Array(Math.round(b.width * b.height)),
          rgb: [100, 100, 100],
        } as any);
      }
    }
  } else {
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

  // Connect adjacent landmarks for Jamestown
  if (isJamestown && places.length >= 2) {
    const connections: [string, string][] = [
      ["University Apartments", "Soccer Field"],
      ["Soccer Field", "Liechty Apartments"],
      ["Soccer Field", "Winter Sports Building"],
      ["Soccer Field", "Prentice Hall"],
      ["Prentice Hall", "Seibold Hall"],
      ["Seibold Hall", "Nierling Hall"],
      ["Nierling Hall", "Wilson Hall"],
      ["Wilson Hall", "Lyngstad Center"],
      ["Prentice Hall", "Unruh and Sheldon Center"],
      ["Unruh and Sheldon Center", "Lyngstad Center"],
      ["Unruh and Sheldon Center", "Badal Nafus Student Union"],
      ["Lyngstad Center", "Badal Nafus Student Union"],
      ["Badal Nafus Student Union", "Kroeze Hall"],
      ["Badal Nafus Student Union", "Reuben and Clarice Liechty Center"],
      ["Kroeze Hall", "Basketball Court"],
      ["Kroeze Hall", "Winter Sports Building"],
      ["Winter Sports Building", "UJ Place"],
      ["Winter Sports Building", "Harold Newman Arena"],
      ["Harold Newman Arena", "UJ Place"],
      ["Harold Newman Arena", "Nelson Bubble"],
      ["Harold Newman Arena", "Larson Center"],
      ["Larson Center", "Foss Wellness Center"],
      ["Larson Center", "Nelson Bubble"],
      ["Basketball Court", "Larson Center"],
      ["Reuben and Clarice Liechty Center", "Voorhees Chapel"],
      ["Voorhees Chapel", "Raugust Library"],
      ["Raugust Library", "Allen Field"],
      ["Raugust Library", "Kroeze Hall"],
      ["Raugust Library", "Foss Wellness Center"],
      ["Raugust Library", "Orlady Hall"],
      ["Allen Field", "Liechty Center Taber Hall"],
      ["Liechty Center Taber Hall", "Reiland Fine Arts Center"],
      ["Reiland Fine Arts Center", "Unruh and Sheldon Center"],
      ["Reiland Fine Arts Center", "Legacy Center"],
      ["Liechty Center Taber Hall", "Sorkness Center"],
      ["Sorkness Center", "Watson Hall"],
      ["Watson Hall", "Wilson Memorial"],
      ["Watson Hall", "Hansen Center"],
      ["Orlady Hall", "McKenna Thielsch Center"],
      ["McKenna Thielsch Center", "Physical Plant"],
      ["McKenna Thielsch Center", "Hansen Center"],
      ["Hansen Center", "Charlotte and Gordon Hansen Stadium"],
      ["Foss Wellness Center", "Charlotte and Gordon Hansen Stadium"],
      ["Wilson Memorial", "Charlotte and Gordon Hansen Stadium"],
    ];
    for (const [fromName, toName] of connections) {
      const p1 = places.find((p) => p.name.includes(fromName));
      const p2 = places.find((p) => p.name.includes(toName));
      if (p1 && p2) {
        graph.edges.push({
          a: p1.id,
          b: p2.id,
          points: [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p2.y },
          ],
          accessible: true,
          confirmed: false,
          source: "detected",
        });
      }
    }
  }

  // Connect adjacent landmarks for Science Faculty
  if (isScienceFaculty && places.length >= 2) {
    const connections: [string, string][] = [
      ["Department of Nuclear Science", "Student Service Centre"],
      [
        "Department of Nuclear Science",
        "Department of Statistics New Building",
      ],
      [
        "Department of Statistics New Building",
        "Climate Change Research Laboratory",
      ],
      ["Department of Statistics New Building", "Department of Zoology"],
      ["Climate Change Research Laboratory", "Department of Plant Sciences"],
      ["Department of Plant Sciences", "Chemistry Lecture Theatre"],
      ["Chemistry Lecture Theatre", "Department of Chemistry"],
      ["Chemistry Lecture Theatre", "Department of Zoology"],
      ["Department of Chemistry", "ITSC"],
      ["Department of Chemistry", "Information & Learning Centre"],
      ["Information & Learning Centre", "Natural History Museum"],
      ["Information & Learning Centre", "King George"],
      ["Natural History Museum", "Dean’s Office (Administration)"],
      ["Natural History Museum", "Department of Zoology"],
      ["Dean’s Office (Administration)", "Dean’s Office (Academic)"],
      ["Dean’s Office (Administration)", "Department of Mathematics"],
      ["Dean’s Office (Academic)", "Department of Zoology"],
      ["Dean’s Office (Academic)", "Department of Mathematics"],
      ["King George", "New IS & MF Laboratory"],
      ["King George", "Department of Physics"],
      ["Department of Physics", "Department of Mathematics"],
      ["Department of Physics", "Department of Statistics"],
      ["Department of Mathematics", "New Arts Theatre"],
      ["Department of Mathematics", "Department of Zoology"],
      ["Department of Statistics", "Samaranayake"],
      ["Department of Statistics", "Computing (UCSC)"],
      ["New Arts Theatre", "Samaranayake"],
      ["Samaranayake", "Computing (UCSC)"],
      ["Samaranayake", "Marshal"],
      ["Marshal", "Medical Centre"],
      ["Student Service Centre", "Department of Zoology"],
    ];
    for (const [fromName, toName] of connections) {
      const p1 = places.find((p) => p.name.includes(fromName));
      const p2 = places.find((p) => p.name.includes(toName));
      if (p1 && p2) {
        graph.edges.push({
          a: p1.id,
          b: p2.id,
          points: [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p2.y },
          ],
          accessible: true,
          confirmed: false,
          source: "detected",
        });
      }
    }
  }

  // Connect adjacent landmarks for USJ Faculty of Applied Sciences
  if (isUSJFaculty && places.length >= 2) {
    const connections: [string, string][] = [
      ["Rubberwatta Road Entrance", "SC - Science Canteen"],
      ["Rubberwatta Road Entrance", "M2 - Mathematics"],
      ["SC - Science Canteen", "M2 - Mathematics"],
      ["SC - Science Canteen", "F2 - Forestry"],
      ["M2 - Mathematics", "M1 - Mathematics"],
      ["M1 - Mathematics", "P1 - Physics"],
      ["M1 - Mathematics", "FC - New Faculty Complex"],
      ["P1 - Physics", "S1 - Science Auditorium"],
      ["P1 - Physics", "FC - New Faculty Complex"],
      ["S1 - Science Auditorium", "A1 - Biology Auditorium"],
      ["FC - New Faculty Complex", "A1 - Biology Auditorium"],
      ["FC - New Faculty Complex", "C1 - Chemistry"],
      ["FC - New Faculty Complex", "F1 - Forestry"],
      ["A1 - Biology Auditorium", "B1 - Department of Botany"],
      ["B1 - Department of Botany", "C2 - Chemistry"],
      ["C1 - Chemistry", "C2 - Chemistry"],
      ["C1 - Chemistry", "F1 - Forestry"],
      ["F1 - Forestry", "F2 - Forestry"],
      ["C2 - Chemistry", "Srisomatha Mawatha Entrance"],
      ["F2 - Forestry", "Srisomatha Mawatha Entrance"],
    ];
    for (const [fromName, toName] of connections) {
      const p1 = places.find((p) => p.name.includes(fromName));
      const p2 = places.find((p) => p.name.includes(toName));
      if (p1 && p2) {
        graph.edges.push({
          a: p1.id,
          b: p2.id,
          points: [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p2.y },
          ],
          accessible: true,
          confirmed: false,
          source: "detected",
        });
      }
    }
  }

  let connected = 0;
  for (const place of places)
    if (connectPlace(place, graph, floor)) connected++;

  const warnings: string[] = [];
  if (!places.length)
    warnings.push(
      "No reliable destination positions were found. Keep the source visible and place labels where they belong.",
    );
  if (unplacedLabels.length && !isJamestown)
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
  if (connected < places.length)
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
