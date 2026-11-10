import type { DetectedLabel, OCRLine } from "./types";
import type { LayoutAnalysis, UnresolvedLabel } from "./imported";

const key = (text: string) =>
  text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");

/** Canvas dimensions round independently; transform each axis independently too. */
export function scaleOCRLines(
  lines: OCRLine[],
  xScale: number,
  yScale: number,
): OCRLine[] {
  const box = (b: OCRLine["bbox"]) => ({
    x0: b.x0 * xScale,
    x1: b.x1 * xScale,
    y0: b.y0 * yScale,
    y1: b.y1 * yScale,
  });
  return lines.map((l) => ({
    ...l,
    bbox: box(l.bbox),
    words: l.words.map((w) => ({ ...w, bbox: box(w.bbox) })),
  }));
}

/** Fuse independent evidence; keep uncertainty rather than cloning conflicting pins. */
export function mergeDetections(
  primary: DetectedLabel[],
  layout: LayoutAnalysis,
  width: number,
  height: number,
) {
  const labels: DetectedLabel[] = [];
  const unresolved: UnresolvedLabel[] = [...layout.unresolvedLabels];
  const blockedNumbers = new Set<string>();
  const close = Math.max(12, Math.min(width, height) * 0.025);
  const candidates =
    layout.labels.length >= 10
      ? [...layout.labels, ...primary.filter((l) => l.source === "legend")]
      : [...primary.filter((l) => l.source === "legend"), ...layout.labels];
  for (const label of candidates) {
    if (label.number && blockedNumbers.has(label.number)) continue;
    if (
      ![label.x, label.y, label.confidence].every(Number.isFinite) ||
      label.x < 0 ||
      label.y < 0 ||
      label.x > width ||
      label.y > height
    )
      continue;
    if (
      unresolved.some(
        (u) => u.reason === "ambiguous-key" && key(u.text) === key(label.text),
      )
    )
      continue;
    const previous = labels.find(
      (l) =>
        (l.number && label.number && l.number === label.number) ||
        (key(l.text) === key(label.text) && (!l.number || !label.number)),
    );
    if (!previous) {
      labels.push(label);
      continue;
    }
    const sameName = key(previous.text) === key(label.text);
    if (
      sameName &&
      Math.hypot(previous.x - label.x, previous.y - label.y) <= close
    )
      continue;
    // Verified layout landmarks (e.g. from comprehensive campus directory or landmark detection)
    // take precedence over unverified raw badge crops from primary detection.
    if (layout.labels.length >= 10 && layout.labels.includes(previous)) {
      continue;
    }
    // A targeted digit read is stronger than a generic text-center observation,
    // but two legend positions for one key must remain unresolved.
    if (previous.source === "legend" && label.source === "label") {
      if (!previous.region && label.region) previous.region = label.region;
      if (!previous.aliases && label.aliases) previous.aliases = label.aliases;
      continue;
    }
    labels.splice(labels.indexOf(previous), 1);
    if (label.number) blockedNumbers.add(label.number);
    unresolved.push({
      text: previous.text,
      confidence: Math.min(previous.confidence, label.confidence),
      reason: "ambiguous-key",
    });
    if (!sameName)
      unresolved.push({
        text: label.text,
        confidence: label.confidence,
        reason: "ambiguous-key",
      });
  }
  const seen = new Set<string>();
  return {
    labels: labels.slice(0, 300),
    unresolved: unresolved
      .filter((u) => {
        const name = key(u.text);
        if (!name || labels.some((l) => key(l.text) === name) || seen.has(name))
          return false;
        seen.add(name);
        return true;
      })
      .slice(0, 300),
  };
}
