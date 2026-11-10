/**
 * Source-derived candidate extraction from anti unieway/src/import/vision.mjs.
 * Copyright (c) 2026 UniWay contributors, MIT; see LICENSE in this directory.
 * Complete vision engine with campus directory matching, road skeletonization, and walkway topology.
 */
import type { PathNode } from "../../campus";
import { detectedEdge } from "../../mapEdges";
import type { PreparedEdge } from "../../mapEdges";
import type { DetectedLabel, OCRLine } from "../types";
import { analyzeRaster } from "./vision";
import type {
  CandidateRegion,
  LayoutAnalysis,
  LayoutInput,
  UnresolvedLabel,
} from "./types";

export type {
  LayoutAnalysis,
  LayoutInput,
  CandidateRegion,
  UnresolvedLabel,
} from "./types";

export {
  analyzeRaster,
  polylineLength,
  skeletonize,
  traceGraph,
  connectPlace,
} from "./vision";
export {
  cleanLegendName,
  colorDistance,
  legendSwatches,
  paletteRegions,
} from "./palette";
export { classifyMapType, analyzeFloorPlan, detectWalls } from "./floorplan";

/**
 * Propose observed places, candidate building regions, and walkway network from input pixels and OCR.
 */
export function analyzeLayout({
  image,
  lines: rawLines,
  name = "",
}: LayoutInput): LayoutAnalysis {
  const { width, height, data } = image;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 10 ||
    height < 10 ||
    width > 2048 ||
    height > 2048 ||
    data.length !== width * height * 4
  ) {
    throw new Error(
      "Invalid layout pixels. Use an image up to 2048 pixels per side.",
    );
  }

  const result = analyzeRaster({
    pixels: data,
    width,
    height,
    lines: rawLines,
    name,
    letterbox: false,
  });

  const labels: DetectedLabel[] = result.places.map((p) => {
    const lbl: DetectedLabel = {
      text: p.name,
      x: p.x,
      y: p.y,
      confidence: p.confidence,
      source: p.source || ("legend" as const),
    };
    if (p.number !== undefined) lbl.number = p.number;
    if (p.category !== undefined && p.category !== "Services")
      lbl.category = p.category;
    if (p.aliases && p.aliases.length > 0) lbl.aliases = p.aliases;
    return lbl;
  });

  const unresolvedLabels: UnresolvedLabel[] = result.unplacedLabels.map(
    (u) => ({
      text: u.name,
      confidence: u.confidence,
      reason: (u.reason as any) || ("ambiguous-color" as const),
      color: u.color,
    }),
  );

  const candidateRegions: CandidateRegion[] = result.buildings.map((b) => ({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    color: b.color,
  }));

  // If no places were recognized, do not fabricate paths from unlabeled shapes
  if (result.places.length === 0) {
    return {
      title: result.title,
      labels: [],
      unresolvedLabels,
      candidateRegions,
      layoutKind: result.layoutKind,
      nodes: [],
      edges: [],
      buildings: candidateRegions,
      roads: [],
      warnings: result.warnings,
    };
  }

  // Build graph nodes and edges
  const nodes: PathNode[] = [];
  const edges: PreparedEdge[] = [];
  const nodeLookup = new Set<string>();

  const addNode = (id: string, x: number, y: number, landmark: string) => {
    if (!nodeLookup.has(id)) {
      nodeLookup.add(id);
      nodes.push({ id, x, y, landmark });
    }
  };

  // Label centres are not entrances. Keep graph nodes on observed linework.
  for (const j of result.junctions) {
    addNode(j.id, j.x, j.y, "the marked path");
  }

  for (const p of result.places) {
    addNode(p.id, p.x, p.y, p.name);
  }

  for (let eIdx = 0; eIdx < result.edges.length; eIdx++) {
    const e = result.edges[eIdx];
    const pts = e.points && e.points.length > 1 ? e.points : null;
    if (!pts || pts.length <= 2) {
      edges.push(
        detectedEdge({
          from: e.a,
          to: e.b,
          stepFree: e.accessible,
        }),
      );
    } else {
      let prevId = e.a;
      for (let k = 1; k < pts.length - 1; k++) {
        const bendId = `bend-${eIdx}-${k}`;
        addNode(bendId, pts[k].x, pts[k].y, "the marked path");
        edges.push(
          detectedEdge({
            from: prevId,
            to: bendId,
            stepFree: e.accessible,
          }),
        );
        prevId = bendId;
      }
      edges.push(
        detectedEdge({
          from: prevId,
          to: e.b,
          stepFree: e.accessible,
        }),
      );
    }
  }

  return {
    title: result.title,
    labels,
    unresolvedLabels,
    candidateRegions,
    layoutKind: result.layoutKind,
    nodes,
    edges,
    buildings: candidateRegions,
    roads: result.roads,
    warnings: result.warnings,
  };
}
