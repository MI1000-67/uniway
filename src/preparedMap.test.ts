import { describe, expect, it } from "vitest";
import {
  addConnection,
  newMap,
  moveMapNode,
  removeMapNode,
  reviewMap,
  routeOnMap,
  routesOnMap,
  autoConnectPlaces,
} from "./preparedMap";
import type { PreparedMap } from "./preparedMap";
import {
  MAP_EXPIRY_DURATION,
  mapExpiresAt,
  mapRemainingTime,
  formatMapExpiration,
  isMapExpired,
} from "./session";

export function fixtureMap(): PreparedMap {
  return {
    ...newMap({
      id: "campus",
      name: "Campus.png",
      url: "blob:campus",
      width: 1000,
      height: 700,
    }),
    name: "My Campus",
    nodes: [
      { id: "gate", x: 100, y: 100, landmark: "Main Entrance" },
      { id: "junction", x: 100, y: 400, landmark: "Garden junction" },
      { id: "library", x: 500, y: 400, landmark: "Library" },
    ],
    places: [
      {
        id: "gate",
        nodeId: "gate",
        name: "Main Entrance",
        category: "Services",
        entrance: true,
      },
      {
        id: "library",
        nodeId: "library",
        name: "Library",
        category: "Library",
        entrance: false,
      },
    ],
    edges: [
      { from: "gate", to: "junction", stepFree: true },
      { from: "junction", to: "library", stepFree: true },
      { from: "gate", to: "library", stepFree: false },
    ],
  };
}

describe("uploaded map routing", () => {
  it("moving a pin preserves other bends and invalidates adjoining step-free claims", () => {
    const original = { ...fixtureMap(), published: true };
    const moved = moveMapNode(original, "library", { x: 450, y: 350 });
    expect(moved.published).toBe(false);
    expect(moved.nodes.find((n) => n.id === "junction")).toEqual(
      original.nodes.find((n) => n.id === "junction"),
    );
    expect(moved.places.find((p) => p.id === "library")?.labelPoint).toEqual({
      x: 450,
      y: 350,
    });
    expect(moved.edges.find((e) => e.to === "junction")?.stepFree).toBe(true);
    expect(
      moved.edges.filter((e) => e.to === "library").every((e) => !e.stepFree),
    ).toBe(true);
    expect(routeOnMap(moved, "gate", "library", true)).toBeNull();
    expect(original.nodes.find((n) => n.id === "library")?.x).toBe(500);
    expect(moveMapNode(original, "library", { x: Infinity, y: 200 })).toBe(
      original,
    );
    expect(moveMapNode(original, "library", { x: 1001, y: 200 })).toBe(
      original,
    );
  });
  it("routes only along the drawn paths and never uses the demo campus scale", () => {
    const route = routeOnMap(fixtureMap(), "gate", "library", false)!;
    expect(route.points.map((p) => p.id)).toEqual(["gate", "library"]);
    expect(route.meters).toBeNull();
    expect(route.minutes).toBeNull();
    expect(route.instructions.join(" ")).not.toMatch(
      /east|west|north|south| m /,
    );
  });
  it("uses the supplied calibration and verified step-free alternative", () => {
    const map = { ...fixtureMap(), metersPerPixel: 0.5 };
    expect(routeOnMap(map, "gate", "library", false)?.meters).toBe(250);
    const route = routeOnMap(map, "gate", "library", true)!;
    expect(route.points.map((p) => p.id)).toEqual([
      "gate",
      "junction",
      "library",
    ]);
    expect(route.meters).toBe(350);
    expect(route.minutes).toBe(5);
  });
  it("rejects disconnected places and unavailable step-free routes", () => {
    const map = {
      ...fixtureMap(),
      edges: [{ from: "gate", to: "junction", stepFree: false }],
    };
    expect(reviewMap(map).join(" ")).toContain("Connect these places");
    expect(routeOnMap(map, "gate", "library", false)).toBeNull();
    expect(routeOnMap(map, "gate", "junction", true)).toBeNull();
  });
  it("prevents self edges and updates accessibility on duplicate connections", () => {
    expect(addConnection([], "gate", "gate", true)).toEqual([]);
    const edges = addConnection([], "gate", "library", false);
    expect(addConnection(edges, "library", "gate", true)).toEqual([
      { from: "gate", to: "library", stepFree: true },
    ]);
  });
  it("removes the place and incident paths when deleting a node", () => {
    const updated = removeMapNode(
      { ...fixtureMap(), published: true },
      "library",
    );
    expect(updated.places.map((p) => p.id)).toEqual(["gate"]);
    expect(updated.edges).toHaveLength(1);
    expect(updated.published).toBe(false);
  });
  it("requires at least two places and a connected graph to publish", () => {
    expect(reviewMap(newMap(fixtureMap().image))).toHaveLength(2);
    expect(reviewMap(fixtureMap())).toEqual([]);
  });
  it("autoConnectPlaces bridges disconnected places to the nearest path component", () => {
    const disconnectedMap: PreparedMap = {
      ...fixtureMap(),
      edges: [{ from: "gate", to: "junction", stepFree: false }],
    };
    expect(reviewMap(disconnectedMap).length).toBeGreaterThan(0);
    const fixed = autoConnectPlaces(disconnectedMap);
    expect(reviewMap(fixed)).toEqual([]);
    // Step-free connectivity is preserved for non-stair connections
    const newEdge = fixed.edges.find(
      (e) =>
        (e.from === "library" || e.to === "library") &&
        e !== disconnectedMap.edges[0],
    );
    expect(newEdge?.stepFree).toBe(true);
  });
  it("routesOnMap returns three distinct alternative routes and never has undefined in instructions", () => {
    const map = fixtureMap();
    const routes = routesOnMap(map, "gate", "library", false);
    expect(routes).toHaveLength(3);
    expect(routes[0].distancePixels).toBeLessThanOrEqual(
      routes[1].distancePixels,
    );
    expect(routes[1].distancePixels).toBeLessThanOrEqual(
      routes[2].distancePixels,
    );
    expect(routes[0].instructions[0]).toContain("Main Entrance");
    for (const r of routes) {
      for (const inst of r.instructions) {
        expect(inst).not.toContain("undefined");
      }
    }

    // Direct 2-node graph test: verifies alternative paths diverge with distinct waypoints
    const directMap: PreparedMap = {
      ...map,
      nodes: [
        { id: "p1", x: 100, y: 100, landmark: "Room A" },
        { id: "p2", x: 300, y: 100, landmark: "Room B" },
      ],
      edges: [{ from: "p1", to: "p2", stepFree: true }],
      places: [
        {
          id: "pl1",
          nodeId: "p1",
          name: "Room A",
          category: "Teaching",
          entrance: true,
        },
        {
          id: "pl2",
          nodeId: "p2",
          name: "Room B",
          category: "Teaching",
          entrance: false,
        },
      ],
    };
    const directRoutes = routesOnMap(directMap, "p1", "p2", false);
    expect(directRoutes).toHaveLength(3);
    expect(directRoutes[0].points.length).toBe(2);
    expect(directRoutes[1].points.length).toBeGreaterThanOrEqual(3);
    expect(directRoutes[2].points.length).toBeGreaterThanOrEqual(3);
    for (const r of directRoutes) {
      for (const inst of r.instructions) {
        expect(inst).not.toContain("undefined");
      }
    }
  });
  it("manages 3-hour map disappearance lifecycle with accurate countdown formatting", () => {
    expect(MAP_EXPIRY_DURATION).toBe(3 * 60 * 60 * 1000);
    const now = 1000000;
    const expires = mapExpiresAt(now);
    expect(expires).toBe(now + 3 * 3600 * 1000);
    expect(isMapExpired(expires, now)).toBe(false);
    expect(isMapExpired(expires, expires)).toBe(true);
    expect(isMapExpired(expires, expires + 1000)).toBe(true);

    // Remaining time
    expect(mapRemainingTime(expires, now)).toBe(3 * 3600 * 1000);
    expect(mapRemainingTime(expires, expires + 5000)).toBe(0);

    // Formatting
    expect(formatMapExpiration(3 * 3600 * 1000)).toBe("3h 0m");
    expect(formatMapExpiration(2 * 3600 * 1000 + 45 * 60 * 1000)).toBe(
      "2h 45m",
    );
    expect(formatMapExpiration(59 * 60 * 1000 + 30 * 1000)).toBe("59m 30s");
    expect(formatMapExpiration(45 * 1000)).toBe("0m 45s");
    expect(formatMapExpiration(0)).toBe("0m 0s");
  });
});
