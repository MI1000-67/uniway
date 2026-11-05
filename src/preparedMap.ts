import type { Category, PathEdge, PathNode, Point } from "./campus";
import type { UploadedImage } from "./UploadPanel";
import { findRoute } from "./routing";
import { findRouteAlternatives } from "./routeAlternatives";
import type { EngineReport } from "./engine/types";

export type MapPlace = {
  id: string;
  nodeId: string;
  name: string;
  aliases?: string[];
  category: Category;
  entrance: boolean;
  labelPoint?: Point;
  labelNumber?: string;
  approachEstimated?: boolean;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
  };
};
export type PreparedMap = {
  image: UploadedImage;
  name: string;
  nodes: PathNode[];
  edges: PathEdge[];
  places: MapPlace[];
  metersPerPixel: number | null;
  published: boolean;
  analysis?: EngineReport;
  northOffset?: number | null;
  unresolvedLabels?: {
    id: string;
    text: string;
    confidence: number;
    reason: string;
  }[];
};

export function newMap(image: UploadedImage): PreparedMap {
  return {
    image,
    name: image.name.replace(/\.[^.]+$/, ""),
    nodes: [],
    edges: [],
    places: [],
    metersPerPixel: null,
    published: false,
  };
}

export function addConnection(
  edges: PathEdge[],
  from: string,
  to: string,
  stepFree: boolean,
): PathEdge[] {
  if (from === to) return edges;
  const existing = edges.find(
    (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from),
  );
  return existing
    ? edges.map((e) => (e === existing ? { ...e, stepFree } : e))
    : [...edges, { from, to, stepFree }];
}

export function removeMapNode(map: PreparedMap, id: string): PreparedMap {
  return {
    ...map,
    published: false,
    nodes: map.nodes.filter((n) => n.id !== id),
    places: map.places.filter((p) => p.nodeId !== id),
    edges: map.edges.filter((e) => e.from !== id && e.to !== id),
  };
}

/** Moving an entrance invalidates adjoining accessibility assumptions and review. */
export function moveMapNode(
  map: PreparedMap,
  id: string,
  point: Point,
): PreparedMap {
  if (
    !map.nodes.some((n) => n.id === id) ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < 0 ||
    point.y < 0 ||
    point.x > map.image.width ||
    point.y > map.image.height
  )
    return map;
  return {
    ...map,
    published: false,
    nodes: map.nodes.map((n) => (n.id === id ? { ...n, ...point } : n)),
    places: map.places.map((p) =>
      p.nodeId === id
        ? { ...p, labelPoint: point, approachEstimated: false }
        : p,
    ),
    edges: map.edges.map((e) =>
      e.from === id || e.to === id ? { ...e, stepFree: false } : e,
    ),
  };
}

export function reviewMap(map: PreparedMap): string[] {
  const problems: string[] = [];
  if (!map.name.trim()) problems.push("Give your campus map a name.");
  if (map.places.length < 2)
    problems.push(
      "Add at least two named places, such as an entrance and a library.",
    );
  if (!map.edges.length)
    problems.push("Trace a walking path between your places.");
  const first = map.places[0];
  if (first && map.places.length > 1 && map.edges.length) {
    const connected = new Set([first.nodeId]);
    const neighbors = new Map(
      map.nodes.map((node) => [node.id, [] as string[]]),
    );
    for (const edge of map.edges) {
      neighbors.get(edge.from)?.push(edge.to);
      neighbors.get(edge.to)?.push(edge.from);
    }
    const queue = [first.nodeId];
    for (let i = 0; i < queue.length; i++)
      for (const id of neighbors.get(queue[i]) ?? []) {
        if (!connected.has(id)) {
          connected.add(id);
          queue.push(id);
        }
      }
    const disconnected = map.places.filter((p) => !connected.has(p.nodeId));
    if (disconnected.length)
      problems.push(
        `Connect these places to the path network: ${disconnected.map((p) => p.name).join(", ")}.`,
      );
  }
  return problems;
}

export function routeOnMap(
  map: PreparedMap,
  from: string,
  to: string,
  stepFree: boolean,
) {
  const found = findRoute(from, to, stepFree, map.nodes, map.edges);
  if (!found) return null;
  return describeMapRoute(map, found.points);
}

export function routesOnMap(
  map: PreparedMap,
  from: string,
  to: string,
  stepFree: boolean,
) {
  return findRouteAlternatives(from, to, stepFree, map.nodes, map.edges).map(
    (route) => describeMapRoute(map, route.points),
  );
}

function describeMapRoute(map: PreparedMap, points: PathNode[]) {
  const found = { points };
  const pixels = found.points
    .slice(1)
    .reduce(
      (total, p, i) =>
        total + Math.hypot(p.x - found.points[i].x, p.y - found.points[i].y),
      0,
    );
  const meters =
    map.metersPerPixel === null
      ? null
      : Math.round(pixels * map.metersPerPixel);
  return {
    points: found.points,
    distancePixels: pixels,
    meters,
    minutes:
      meters === null
        ? null
        : meters === 0
          ? 0
          : Math.max(1, Math.ceil(meters / 75)),
    instructions:
      found.points.length === 1
        ? ["You’re already at your destination."]
        : [
            `Start at ${found.points[0].landmark}.`,
            ...routeLegs(map, found.points),
            "You’ve arrived.",
          ],
  };
}

function routeLegs(map: PreparedMap, points: PathNode[]) {
  const instructions: string[] = [];
  let distance = 0;
  points.slice(1).forEach((p, i) => {
    distance += Math.hypot(p.x - points[i].x, p.y - points[i].y);
    if (i < points.length - 2 && p.landmark === "the marked path") return;
    const amount =
      map.metersPerPixel === null
        ? ""
        : ` for ${Math.round(distance * map.metersPerPixel)} m`;
    instructions.push(`Follow the marked path${amount} to ${p.landmark}.`);
    distance = 0;
  });
  return instructions;
}
