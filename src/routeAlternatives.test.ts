import { describe, expect, it } from "vitest";
import type { PathEdge, PathNode } from "./campus";
import { findRouteAlternatives } from "./routeAlternatives";

const node = (id: string, x: number, y: number): PathNode => ({
  id,
  x,
  y,
  landmark: id,
});
const edge = (from: string, to: string, stepFree = true): PathEdge => ({
  from,
  to,
  stepFree,
});
const nodes = [
  node("start", 0, 0),
  node("near", 1, 0),
  node("middle", 1, 1),
  node("far", 1, 2),
  node("end", 2, 0),
];
const edges = [
  edge("start", "near"),
  edge("near", "end"),
  edge("start", "middle"),
  edge("middle", "end"),
  edge("start", "far"),
  edge("far", "end"),
];
const ids = (path: { points: PathNode[] }) =>
  path.points.map((point) => point.id);

describe("walking route alternatives", () => {
  it("returns three distinct actual paths in ascending length order", () => {
    const routes = findRouteAlternatives("start", "end", false, nodes, edges);
    expect(routes.map(ids)).toEqual([
      ["start", "near", "end"],
      ["start", "middle", "end"],
      ["start", "far", "end"],
    ]);
    expect(routes.map((route) => route.distancePixels)).toEqual([
      2,
      2 * Math.SQRT2,
      2 * Math.sqrt(5),
    ]);
  });

  it("filters every candidate to explicitly step-free edges", () => {
    const accessible = edges.map((connection) =>
      connection.to === "near"
        ? { ...connection, stepFree: false }
        : connection,
    );
    const routes = findRouteAlternatives(
      "start",
      "end",
      true,
      nodes,
      accessible,
    );
    expect(routes.map(ids)).toEqual([
      ["start", "middle", "end"],
      ["start", "far", "end"],
    ]);
    expect(
      findRouteAlternatives("start", "end", false, nodes, accessible),
    ).toHaveLength(3);
  });

  it("returns fewer choices when the graph has no genuine alternative", () => {
    const branches = [
      edge("start", "near"),
      edge("near", "end"),
      edge("near", "middle"),
      edge("middle", "far"),
      edge("far", "near"),
    ];
    const routes = findRouteAlternatives(
      "start",
      "end",
      false,
      nodes,
      branches,
    );
    expect(routes.map(ids)).toEqual([["start", "near", "end"]]);
  });

  it("handles unreachable, missing, identical endpoints and zero choice limits", () => {
    expect(findRouteAlternatives("start", "end", false, nodes, [])).toEqual([]);
    expect(
      findRouteAlternatives("missing", "end", false, nodes, edges),
    ).toEqual([]);
    expect(findRouteAlternatives("start", "start", true, nodes, edges)).toEqual(
      [{ points: [nodes[0]], distancePixels: 0 }],
    );
    expect(
      findRouteAlternatives("start", "end", false, nodes, edges, 0),
    ).toEqual([]);
    expect(
      findRouteAlternatives("start", "end", false, nodes, edges, 1),
    ).toHaveLength(1);
  });

  it("deduplicates reversed edges and ignores malformed connections", () => {
    const routes = findRouteAlternatives("start", "end", false, nodes, [
      ...edges,
      edge("near", "start"),
      edge("start", "missing"),
      edge("near", "near"),
    ]);
    expect(routes.map(ids)).toEqual([
      ["start", "near", "end"],
      ["start", "middle", "end"],
      ["start", "far", "end"],
    ]);
  });

  it("handles zero-length edges without loops or non-finite distances", () => {
    const coincident = [...nodes, node("same", 0, 0), node("invalid", NaN, 1)];
    const routes = findRouteAlternatives("start", "end", false, coincident, [
      ...edges,
      edge("start", "same"),
      edge("same", "near"),
      edge("start", "invalid"),
      edge("invalid", "end"),
    ]);
    expect(routes).toHaveLength(3);
    for (const route of routes) {
      expect(Number.isFinite(route.distancePixels)).toBe(true);
      expect(new Set(ids(route)).size).toBe(route.points.length);
      expect(ids(route)).not.toContain("invalid");
    }
  });

  it("matches exhaustive simple-path rankings across cyclic graph variants", () => {
    const graph = [
      node("a", 0, 0),
      node("b", 1, 2),
      node("c", 3, 1),
      node("d", 4, 3),
      node("e", 5, 0),
    ];
    const possible = [
      edge("a", "b"),
      edge("a", "c"),
      edge("b", "c"),
      edge("b", "d"),
      edge("c", "d"),
      edge("c", "e"),
      edge("d", "e"),
    ];
    for (let mask = 0; mask < 128; mask++) {
      const connections = possible.filter((_, i) => (mask & (1 << i)) !== 0);
      const lengths: number[] = [];
      function enumerate(
        current: string,
        visited: Set<string>,
        distance: number,
      ) {
        if (current === "e") {
          lengths.push(distance);
          return;
        }
        for (const connection of connections) {
          const next =
            connection.from === current
              ? connection.to
              : connection.to === current
                ? connection.from
                : null;
          if (!next || visited.has(next)) continue;
          const a = graph.find((point) => point.id === current)!;
          const b = graph.find((point) => point.id === next)!;
          enumerate(
            next,
            new Set([...visited, next]),
            distance + Math.hypot(a.x - b.x, a.y - b.y),
          );
        }
      }
      enumerate("a", new Set(["a"]), 0);
      const expected = lengths.sort((a, b) => a - b).slice(0, 3);
      const routes = findRouteAlternatives("a", "e", false, graph, connections);
      expect(routes).toHaveLength(expected.length);
      expect(
        new Set(routes.map((route) => JSON.stringify(ids(route)))).size,
      ).toBe(routes.length);
      routes.forEach((route, i) => {
        expect(route.distancePixels).toBeCloseTo(expected[i], 10);
        expect(new Set(ids(route)).size).toBe(route.points.length);
      });
    }
  });
});
