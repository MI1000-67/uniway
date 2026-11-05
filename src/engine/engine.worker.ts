import { findNumberBadges, extractLinework } from "./core";
import type { PixelImage } from "./types";
import type { OCRLine } from "./types";
import { analyzeLayout } from "./imported";

self.onmessage = (
  event: MessageEvent<
    | { image: PixelImage; pathImage: PixelImage }
    | { kind: "layout"; image: PixelImage; lines: OCRLine[]; name?: string }
  >,
) => {
  try {
    if ("kind" in event.data && event.data.kind === "layout") {
      self.postMessage(analyzeLayout(event.data));
      return;
    }
    if (!("pathImage" in event.data)) return;
    const badges = findNumberBadges(event.data.image);
    const path = extractLinework(event.data.pathImage);
    self.postMessage({
      badges,
      path: { nodes: path.nodes, edges: path.edges, coverage: path.coverage },
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "This map needs manual refinement.",
    });
  }
};
