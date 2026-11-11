/** Adapted from anti unieway/src/import/floorplan.mjs (MIT), © 2026 UniWay contributors. */
import type { DetectedLabel, PixelImage } from "../types";
import { components } from "./components";
import type { CandidateRegion, LayoutAnalysis, LayoutLine } from "./types";

export const ROOM_TEXT =
  /\b(room|rm|office|lab|conference\s*hall|level|fl|floor|suite|wc|toilet|restroom|stairs|lift|elevator|corridor|entrance|exit|lobby|cafe|kitchen|storage|auditorium|lounge|dining|staff|lecture\s*hall|computer\s*room|you\s*are\s*here)\b/i;
export const ROOM_CODE =
  /^[A-Za-z]{1,3}-?\d{1,4}[A-Za-z]?$|^[A-Za-z]\s*\d{1,4}$|^\d{1,4}[A-Za-z]?$/i;
export const FLOOR_TITLE =
  /\b(floor\s*plan|ground\s*floor|first\s*floor|second\s*floor|lower\s*level|upper\s*level|basement|level\s*-?\s*\d)\b/i;

export function detectWalls({ data, width, height }: PixelImage) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    if (data[i * 4 + 3] < 128) continue;
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2];
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    if (brightness < 115 && Math.max(r, g, b) - Math.min(r, g, b) < 45)
      mask[i] = 1;
  }
  return mask;
}

export function classifyMapType(
  { data, width, height }: PixelImage,
  lines: LayoutLine[],
  swatchCount = 0,
): "campus" | "floorplan" {
  const hasFloorKeywords = lines.some(
    (l) =>
      FLOOR_TITLE.test(l.text) ||
      /\b(lower\s*level|lowerlevel|upper\s*level|upperlevel|level\s*-?\s*\d|floor\s*-?\s*\d|basement)\b/i.test(
        l.text,
      ),
  );
  if (hasFloorKeywords) return "floorplan";

  const hasDirectoryKeys = lines.some(
    (l) =>
      /^\s*[A-Za-z]?\d{1,3}[.)\-–\s]\s+\S/u.test(l.text) ||
      /location key|legend\b|directory\b/i.test(l.text),
  );
  if (hasDirectoryKeys) return "campus";

  const roomCount = lines.filter(
    (l) => ROOM_TEXT.test(l.text) || ROOM_CODE.test(l.text.trim()),
  ).length;
  if (roomCount >= 2) return "floorplan";
  if (
    lines.some((l) =>
      /\b(campus|university|faculty|college|field|stadium|arena|avenue|street|drive|blvd|parking|grounds|location key)\b/i.test(
        l.text,
      ),
    )
  )
    return "campus";
  if (swatchCount >= 4) return "campus";
  let saturated = 0,
    wallLike = 0,
    sampled = 0;
  for (let i = 0; i < width * height; i += 4) {
    if (data[i * 4 + 3] < 128) continue;
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2];
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    sampled++;
    if (spread > 35 && brightness > 60 && brightness < 235) saturated++;
    if (brightness < 100 && spread < 30) wallLike++;
  }
  const saturatedRatio = saturated / Math.max(1, sampled);
  const wallRatio = wallLike / Math.max(1, sampled);
  if (roomCount >= 1 && saturatedRatio < 0.25) return "floorplan";
  if (wallRatio > 0.05 && saturatedRatio < 0.05) return "floorplan";
  return "campus";
}

/** Enclosed regions suggest rooms; neither enclosure nor aspect proves a walkway. */
export function segmentRooms(
  wallMask: Uint8Array,
  width: number,
  height: number,
) {
  const open = Uint8Array.from(wallMask, (v) => (v ? 0 : 1));
  return components(open, width, height).filter(
    (c) =>
      !c.border &&
      c.pixels.length >= Math.max(25, width * height * 0.0005) &&
      c.pixels.length < width * height * 0.75,
  );
}

export function analyzeFloorPlan(
  image: PixelImage,
  lines: LayoutLine[],
): LayoutAnalysis {
  const { width, height } = image;
  const rooms = segmentRooms(detectWalls(image), width, height);
  const labels: DetectedLabel[] = [];
  const candidateRegions: CandidateRegion[] = rooms.slice(0, 300).map((r) => ({
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  }));
  for (const l of lines) {
    const alphanum = l.text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    if (
      l.confidence < 20 ||
      alphanum < 2 ||
      l.text.length > 80 ||
      FLOOR_TITLE.test(l.text) ||
      /\b(legend|scale|copyright|north|drawing|revision)\b/i.test(l.text) ||
      l.cy < height * 0.04 ||
      l.cy > height * 0.96 ||
      l.height > height * 0.085
    )
      continue;
    const region = candidateRegions.find(
      (r) =>
        l.cx >= r.x &&
        l.cx < r.x + r.width &&
        l.cy >= r.y &&
        l.cy < r.y + r.height,
    );
    const isRoomLabel = ROOM_TEXT.test(l.text) || ROOM_CODE.test(l.text.trim());
    // Retain detected room labels and candidate room names.
    if (!region && !isRoomLabel && l.confidence < 40) continue;
    if (
      labels.some(
        (p) => p.text === l.text && Math.hypot(p.x - l.cx, p.y - l.cy) < 12,
      )
    )
      continue;
    labels.push({
      text: l.text,
      x: l.cx,
      y: l.cy,
      confidence: l.confidence,
      source: "label",
    });
    if (region && !region.label) region.label = l.text;
    if (labels.length >= 300) break;
  }
  return {
    labels,
    candidateRegions,
    layoutKind: "floorplan",
    unresolvedLabels: [],
    edges: [],
    warnings: [
      "Room outlines are draft candidates. Mark and verify entrances, doors and corridors before routing.",
    ],
  };
}
