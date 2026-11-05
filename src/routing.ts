import { nodes, edges } from "./campus";
import type { PathNode, PathEdge } from "./campus";
export type Route = {
  points: PathNode[];
  meters: number;
  minutes: number;
  instructions: string[];
};
export function findRoute(
  start: string,
  end: string,
  stepFree: boolean,
  graphNodes: PathNode[] = nodes,
  graphEdges: PathEdge[] = edges,
): Route | null {
  const lookup = new Map(graphNodes.map((n) => [n.id, n]));
  if (!lookup.has(start) || !lookup.has(end)) return null;
  const distances = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, string>();
  const pending = new Set(lookup.keys());
  while (pending.size) {
    let current: string | undefined;
    let best = Infinity;
    for (const id of pending)
      if ((distances.get(id) ?? Infinity) < best) {
        current = id;
        best = distances.get(id)!;
      }
    if (!current) break;
    pending.delete(current);
    if (current === end) break;
    for (const edge of graphEdges) {
      if (stepFree && !edge.stepFree) continue;
      const next =
        edge.from === current
          ? edge.to
          : edge.to === current
            ? edge.from
            : undefined;
      if (!next || !pending.has(next)) continue;
      const a = lookup.get(current)!,
        b = lookup.get(next)!;
      const cost = best + Math.hypot(a.x - b.x, a.y - b.y);
      if (cost < (distances.get(next) ?? Infinity)) {
        distances.set(next, cost);
        previous.set(next, current);
      }
    }
  }
  if (!distances.has(end)) return null;
  const ids = [end];
  while (ids[0] !== start) {
    const prev = previous.get(ids[0]);
    if (!prev) return null;
    ids.unshift(prev);
  }
  const points = ids.map((id) => lookup.get(id)!);
  return describeRoute(points);
}

export function describeRoute(
  points: PathNode[],
): Route & { distancePixels: number } {
  const distancePixels = points
    .slice(1)
    .reduce(
      (sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y),
      0,
    );
  const meters = Math.round(distancePixels * 0.65);
  const instructions: string[] = [];
  if (points.length === 1)
    instructions.push("You’re already at your destination.");
  else {
    instructions.push(`Start at ${points[0].landmark}.`);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      const direction =
        Math.abs(b.x - a.x) > Math.abs(b.y - a.y)
          ? b.x > a.x
            ? "east"
            : "west"
          : b.y > a.y
            ? "south"
            : "north";
      instructions.push(
        `Walk ${direction} for ${Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 0.65)} m toward ${b.landmark}.`,
      );
    }
    instructions.push("You’ve arrived. Make yourself at home.");
  }
  return {
    points,
    distancePixels,
    meters,
    minutes: meters === 0 ? 0 : Math.max(1, Math.ceil(meters / 75)),
    instructions,
  };
}
