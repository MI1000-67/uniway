import type { Category, PathNode, Point } from "./campus";
import { canWalk, manualEdge } from "./mapEdges";
import type { PreparedEdge } from "./mapEdges";
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
  edges: PreparedEdge[];
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
    name: image.name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim(),
    nodes: [],
    edges: [],
    places: [],
    metersPerPixel: null,
    published: false,
  };
}

export function addConnection(
  edges: PreparedEdge[],
  from: string,
  to: string,
  stepFree: boolean,
): PreparedEdge[] {
  if (from === to) return edges;
  const existing = edges.find(
    (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from),
  );
  return existing
    ? edges.map((e) =>
        e === existing
          ? { ...manualEdge(e.from, e.to, stepFree), origin: e.origin }
          : e,
      )
    : [...edges, manualEdge(from, to, stepFree)];
}

/** Accessibility confirmation is separate from pedestrian access. */
export function reviewConnection(
  map: PreparedMap,
  edge: PreparedEdge,
  kind: "pedestrian" | "accessibility",
  checked: boolean,
): PreparedMap {
  return {
    ...map,
    published: false,
    edges: map.edges.map((e) => {
      if (e !== edge) return e;
      if (kind === "pedestrian")
        return {
          ...e,
          stepFree: checked && e.stepFree,
          review: {
            pedestrian: checked,
            accessibility: checked && e.review.accessibility,
          },
        };
      if (!e.review.pedestrian) return e;
      return {
        ...e,
        stepFree: checked,
        review: { pedestrian: true, accessibility: true },
      };
    }),
  };
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
      e.from === id || e.to === id
        ? {
            ...e,
            stepFree: false,
            review: { pedestrian: false, accessibility: false },
          }
        : e,
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
  const ids = new Set(map.nodes.map((n) => n.id));
  if (
    ids.size !== map.nodes.length ||
    map.nodes.some(
      (n) =>
        ![n.x, n.y].every(Number.isFinite) ||
        n.x < 0 ||
        n.y < 0 ||
        n.x > map.image.width ||
        n.y > map.image.height,
    ) ||
    map.places.some((p) => !ids.has(p.nodeId)) ||
    map.edges.some((e) => e.from === e.to || !ids.has(e.from) || !ids.has(e.to))
  )
    problems.push("Check the map points and path endpoints before navigation.");
  if (
    map.places.some((p) => !p.name.trim()) ||
    new Set(map.places.map((p) => p.name.trim().toLowerCase())).size !==
      map.places.length
  )
    problems.push("Give every place a unique, non-empty name.");
  const unreviewed = map.edges.filter((e) => !canWalk(e)).length;
  if (unreviewed)
    problems.push(
      `Review pedestrian access for ${unreviewed} path segment${unreviewed === 1 ? "" : "s"}. Select a map point to review its connections.`,
    );
  if (map.edges.some((e) => e.stepFree && !e.review?.accessibility))
    problems.push(
      "Confirm accessibility separately for paths marked step-free.",
    );
  if (map.places.length > 1 && map.edges.length) {
    const neighbors = new Map(
      map.nodes.map((node) => [node.id, [] as string[]]),
    );
    for (const edge of map.edges) {
      neighbors.get(edge.from)?.push(edge.to);
      neighbors.get(edge.to)?.push(edge.from);
    }
    const placeNodeIds = new Set(map.places.map((p) => p.nodeId));
    const visited = new Set<string>();
    let largestPlaceComp = new Set<string>();
    let maxPlaces = -1;

    for (const p of map.places) {
      if (!visited.has(p.nodeId)) {
        const comp = new Set<string>();
        const queue = [p.nodeId];
        visited.add(p.nodeId);
        comp.add(p.nodeId);
        while (queue.length > 0) {
          const cur = queue.shift()!;
          for (const next of neighbors.get(cur) ?? []) {
            if (!visited.has(next)) {
              visited.add(next);
              comp.add(next);
              queue.push(next);
            }
          }
        }
        const count = [...comp].filter((id) => placeNodeIds.has(id)).length;
        if (count > maxPlaces) {
          maxPlaces = count;
          largestPlaceComp = comp;
        }
      }
    }

    const disconnected = map.places.filter(
      (p) => !largestPlaceComp.has(p.nodeId),
    );
    if (disconnected.length)
      problems.push(
        `Connect these places to the path network: ${disconnected.map((p) => p.name).join(", ")}.`,
      );
  }
  return problems;
}

export function autoConnectPlaces(map: PreparedMap): PreparedMap {
  if (map.places.length === 0) return map;
  const nodes = [...map.nodes];
  const edges = [...map.edges];
  const nodeLookup = new Map(nodes.map((n) => [n.id, n]));

  for (let i = 0; i < map.places.length; i++) {
    const p = map.places[i];
    if (!nodeLookup.has(p.nodeId)) {
      const x = p.labelPoint?.x ?? Math.round(map.image.width / 2);
      const y = p.labelPoint?.y ?? Math.round(map.image.height / 2);
      const newNode: PathNode = {
        id: p.nodeId || `place-node-${i}`,
        x,
        y,
        landmark: p.name,
      };
      nodes.push(newNode);
      nodeLookup.set(newNode.id, newNode);
    }
  }

  const neighbors = new Map<string, string[]>();
  for (const n of nodes) neighbors.set(n.id, []);
  for (const e of edges) {
    neighbors.get(e.from)?.push(e.to);
    neighbors.get(e.to)?.push(e.from);
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      const comp: string[] = [];
      const queue = [n.id];
      visited.add(n.id);
      while (queue.length > 0) {
        const cur = queue.shift()!;
        comp.push(cur);
        for (const neighbor of neighbors.get(cur) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      components.push(comp);
    }
  }

  const placeNodeIds = new Set(map.places.map((p) => p.nodeId));
  components.sort((a, b) => {
    const placesA = a.filter((id) => placeNodeIds.has(id)).length;
    const placesB = b.filter((id) => placeNodeIds.has(id)).length;
    if (placesB !== placesA) return placesB - placesA;
    return b.length - a.length;
  });

  const primaryComp = new Set(components[0] ?? []);

  for (let c = 1; c < components.length; c++) {
    const comp = components[c];
    let bestFrom = "";
    let bestTo = "";
    let bestDist = Infinity;

    for (const idA of comp) {
      const nodeA = nodeLookup.get(idA);
      if (!nodeA) continue;
      for (const idB of primaryComp) {
        const nodeB = nodeLookup.get(idB);
        if (!nodeB) continue;
        const d = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
        if (d < bestDist) {
          bestDist = d;
          bestFrom = idA;
          bestTo = idB;
        }
      }
    }

    if (bestFrom && bestTo) {
      edges.push(manualEdge(bestFrom, bestTo, false));
      for (const id of comp) primaryComp.add(id);
    }
  }

  for (const p of map.places) {
    if (!primaryComp.has(p.nodeId)) {
      const pNode = nodeLookup.get(p.nodeId);
      if (pNode) {
        let bestTarget: string | null = null;
        let bestDist = Infinity;
        for (const id of primaryComp) {
          const target = nodeLookup.get(id);
          if (!target) continue;
          const d = Math.hypot(pNode.x - target.x, pNode.y - target.y);
          if (d < bestDist) {
            bestDist = d;
            bestTarget = id;
          }
        }
        if (bestTarget) {
          edges.push(manualEdge(p.nodeId, bestTarget, false));
          primaryComp.add(p.nodeId);
        }
      }
    }
  }

  return {
    ...map,
    nodes,
    edges,
  };
}

export function publishMap(map: PreparedMap): PreparedMap | null {
  let candidate = map;
  if (reviewMap(candidate).some((i) => i.startsWith("Connect these places"))) {
    candidate = autoConnectPlaces(candidate);
  }
  if (reviewMap(candidate).length) return null;
  return {
    ...candidate,
    name: candidate.name.trim(),
    places: candidate.places.map((p) => ({ ...p, name: p.name.trim() })),
    published: true,
  };
}

export function routeOnMap(
  map: PreparedMap,
  from: string,
  to: string,
  stepFree: boolean,
) {
  if (!map.published || reviewMap(map).length) return null;
  const found = findRoute(
    from,
    to,
    stepFree,
    map.nodes,
    map.edges.filter((e) => canWalk(e, stepFree)),
  );
  if (!found) return null;
  return describeMapRoute(map, found.points);
}

export function routesOnMap(
  map: PreparedMap,
  from: string,
  to: string,
  stepFree: boolean,
) {
  if (!map.published || reviewMap(map).length) return [];
  return findRouteAlternatives(
    from,
    to,
    stepFree,
    map.nodes,
    map.edges.filter((e) => canWalk(e, stepFree)),
  ).map((route) => describeMapRoute(map, route.points));
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
