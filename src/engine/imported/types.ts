/** Adapted from UniWay (MIT), © 2026 UniWay contributors. */
import type { PathEdge, PathNode } from "../../campus";
import type { DetectedLabel, OCRLine, PixelImage } from "../types";

export type Component = {
  pixels: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  border: boolean;
  value: number;
};
export type PaletteRegion = Component & { rgb: number[]; color: string };
export type LayoutLine = {
  id: number;
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};
export type UnresolvedLabel = {
  text: string;
  confidence: number;
  reason: "ambiguous-color" | "ambiguous-key" | "missing-marker";
  color?: string;
};
export type CandidateRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  label?: string;
};
export type LayoutAnalysis = {
  title?: string;
  labels: DetectedLabel[];
  unresolvedLabels: UnresolvedLabel[];
  layoutKind: "campus" | "floorplan";
  candidateRegions: CandidateRegion[];
  warnings: string[];
  nodes?: PathNode[];
  edges: PathEdge[];
  buildings?: CandidateRegion[];
  roads?: { x: number; y: number }[][];
};
export type LayoutInput = {
  image: PixelImage;
  lines: OCRLine[];
  name?: string;
};
