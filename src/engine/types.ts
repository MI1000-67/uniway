import type { Category } from "../campus";
import type { LayoutLanguage } from "./languages";
export type OCRWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};
export type OCRLine = {
  text: string;
  confidence: number;
  bbox: OCRWord["bbox"];
  words: OCRWord[];
};
export type DetectedLabel = {
  text: string;
  x: number;
  y: number;
  confidence: number;
  source: "legend" | "label";
  number?: string;
  category?: Category;
  aliases?: string[];
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
  };
};
export type EngineReport = {
  version: string;
  language: LayoutLanguage;
  quality: { level: "clear" | "limited"; message: string | null };
  summary: string;
  warnings: string[];
  labelsFound: number;
  pathsFound: number;
  requiresReview: true;
  detectedLabels: DetectedLabel[];
  pathKind: "visible-linework" | "none";
  layoutKind?: "campus" | "floorplan";
  unresolvedCount?: number;
  candidateRegions?: {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    label?: string;
  }[];
};
export type PixelImage = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};
export type Crop = { x: number; y: number; width: number; height: number };
