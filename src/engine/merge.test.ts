import { describe, expect, it } from "vitest";
import { mergeDetections, scaleOCRLines } from "./merge";
import type { DetectedLabel, OCRLine } from "./types";
import type { LayoutAnalysis } from "./imported";

const layout = (labels: DetectedLabel[] = []): LayoutAnalysis => ({
  labels,
  unresolvedLabels: [],
  layoutKind: "campus",
  candidateRegions: [],
  edges: [],
  warnings: [],
});
const label = (x: number, number = "1"): DetectedLabel => ({
  text: "Library",
  x,
  y: 200,
  number,
  confidence: 90,
  source: "legend",
});

describe("integrated extraction evidence", () => {
  it.each([9, 10, 20])(
    "keeps conflicts unresolved with %i layout labels",
    (count) => {
      const candidates = Array.from({ length: count }, (_, i) => ({
        ...label(600, String(i + 1)),
        text: i === 0 ? "Library" : `Building ${i}`,
      }));
      const result = mergeDetections(
        [{ ...label(200), confidence: 99 }],
        layout(candidates),
        1000,
        700,
      );
      expect(result.labels.some((l) => l.text === "Library")).toBe(false);
      expect(result.unresolved).toContainEqual({
        text: "Library",
        confidence: 90,
        reason: "ambiguous-key",
      });
    },
  );
  it("recovers a missing marker using targeted number OCR without duplicating a place", () => {
    const candidate = layout();
    candidate.unresolvedLabels = [
      { text: "Library", confidence: 88, reason: "missing-marker" },
    ];
    expect(mergeDetections([label(200)], candidate, 1000, 700)).toEqual({
      labels: [label(200)],
      unresolved: [],
    });
    expect(
      mergeDetections([label(200)], layout([label(205)]), 1000, 700).labels,
    ).toHaveLength(1);
  });
  it("withholds conflicting positions for one key across detection passes", () => {
    const result = mergeDetections(
      [label(200)],
      layout([label(600), label(605)]),
      1000,
      700,
    );
    expect(result.labels).toEqual([]);
    expect(result.unresolved).toEqual([
      { text: "Library", confidence: 90, reason: "ambiguous-key" },
    ]);
  });
  it("keeps separately numbered places with the same name", () => {
    const result = mergeDetections(
      [label(200), label(600, "2")],
      layout(),
      1000,
      700,
    );
    expect(result.labels).toHaveLength(2);
  });
  it("preserves both conflicting names for one key and prevents later reintroduction", () => {
    const other = { ...label(200), text: "Cafeteria" };
    const result = mergeDetections(
      [label(200)],
      layout([other, other]),
      1000,
      700,
    );
    expect(result.labels).toEqual([]);
    expect(result.unresolved.map((l) => l.text)).toEqual([
      "Library",
      "Cafeteria",
    ]);
  });
  it("uses positioned palette evidence instead of a direct OCR label in the page legend", () => {
    const primary: DetectedLabel = {
      ...label(900),
      source: "label",
      number: undefined,
    };
    expect(
      mergeDetections([primary], layout([label(200)]), 1000, 700).labels,
    ).toEqual([label(200)]);
  });
  it("scales lines and words independently by axis without mutating observations", () => {
    const bbox = { x0: 100, y0: 50, x1: 200, y1: 80 };
    const lines: OCRLine[] = [
      {
        text: "Library",
        confidence: 90,
        bbox,
        words: [{ text: "Library", confidence: 90, bbox }],
      },
    ];
    const scaled = scaleOCRLines(lines, 0.625, 0.6247);
    expect(scaled[0].bbox.y1).toBeCloseTo(49.976);
    expect(scaled[0].words[0].bbox.x0).toBe(62.5);
    expect(lines[0].bbox.x0).toBe(100);
    expect(scaleOCRLines(scaled, 1 / 0.625, 1 / 0.6247)[0].bbox.y1).toBeCloseTo(
      80,
    );
  });
});
