import type { PathEdge } from "./campus";

/** Review belongs to an uploaded graph revision, never to the raster detector. */
export type PreparedEdge = PathEdge & {
  origin: "detected" | "manual";
  review: { pedestrian: boolean; accessibility: boolean };
};

export function detectedEdge(edge: PathEdge): PreparedEdge {
  return {
    from: edge.from,
    to: edge.to,
    stepFree: false,
    origin: "detected",
    review: { pedestrian: false, accessibility: false },
  };
}

/** Drawing a path explicitly confirms pedestrian access, not accessibility. */
export function manualEdge(
  from: string,
  to: string,
  stepFree = false,
): PreparedEdge {
  return {
    from,
    to,
    stepFree,
    origin: "manual",
    review: { pedestrian: true, accessibility: stepFree },
  };
}

export function canWalk(edge: PreparedEdge, stepFree = false): boolean {
  return (
    edge.review?.pedestrian === true &&
    (!stepFree || (edge.review.accessibility === true && edge.stepFree))
  );
}
