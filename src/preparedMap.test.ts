import { manualEdge, detectedEdge } from "./mapEdges";
import { describe, expect, it } from "vitest";
import {
  addConnection,
  newMap,
  moveMapNode,
  removeMapNode,
  reviewMap,
  routeOnMap,
  routesOnMap,
  reviewConnection,
  publishMap,
} from "./preparedMap";
import type { PreparedMap } from "./preparedMap";

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
    published: true,
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
      manualEdge("gate", "junction", true),
      manualEdge("junction", "library", true),
      manualEdge("gate", "library", false),
    ],
  };
}

describe("uploaded map routing", () => {
  it("requires pedestrian review before publication and separate step-free confirmation", () => {
    const draft = {
      ...fixtureMap(),
      published: false,
      edges: [detectedEdge({ from: "gate", to: "library", stepFree: true })],
    };
    expect(draft.edges[0].stepFree).toBe(false);
    expect(publishMap(draft)).toBeNull();
    expect(
      routeOnMap({ ...draft, published: true }, "gate", "library", false),
    ).toBeNull();
    expect(
      routesOnMap({ ...draft, published: true }, "gate", "library", true),
    ).toEqual([]);
    const tooSoon = reviewConnection(
      draft,
      draft.edges[0],
      "accessibility",
      true,
    );
    expect(tooSoon.edges[0].stepFree).toBe(false);
    const walking = reviewConnection(draft, draft.edges[0], "pedestrian", true);
    expect(routeOnMap(walking, "gate", "library", false)).toBeNull();
    const ready = publishMap(walking)!;
    expect(routeOnMap(ready, "gate", "library", false)).not.toBeNull();
    expect(routeOnMap(ready, "gate", "library", true)).toBeNull();
    const accessible = reviewConnection(
      walking,
      walking.edges[0],
      "accessibility",
      true,
    );
    expect(
      routeOnMap(publishMap(accessible)!, "gate", "library", true),
    ).not.toBeNull();
    expect(accessible.edges[0].origin).toBe("detected");
    const revoked = reviewConnection(
      accessible,
      accessible.edges[0],
      "pedestrian",
      false,
    );
    expect(revoked.edges[0]).toMatchObject({
      stepFree: false,
      review: { pedestrian: false, accessibility: false },
    });
    expect(publishMap(revoked)).toBeNull();
  });
  it("rejects missing review metadata, dangling edges and forged accessibility", () => {
    const map = fixtureMap();
    const legacy = {
      ...map,
      edges: [
        { from: "gate", to: "library", stepFree: true },
      ] as PreparedMap["edges"],
    };
    expect(routeOnMap(legacy, "gate", "library", false)).toBeNull();
    expect(
      publishMap({ ...map, edges: [manualEdge("gate", "missing")] }),
    ).toBeNull();
    const forged = manualEdge("gate", "library");
    forged.stepFree = true;
    expect(publishMap({ ...map, edges: [forged] })).toBeNull();
  });
  it("moving a pin preserves other bends and invalidates adjoining step-free claims", () => {
    const original = { ...fixtureMap(), published: true };
    const moved = moveMapNode(original, "library", { x: 450, y: 350 });
    expect(moved.published).toBe(false);
    expect(
      moved.edges
        .filter((e) => e.to === "library")
        .every((e) => !e.review.pedestrian && !e.review.accessibility),
    ).toBe(true);
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
      edges: [manualEdge("gate", "junction", false)],
    };
    expect(reviewMap(map).join(" ")).toContain("Connect these places");
    expect(routeOnMap(map, "gate", "library", false)).toBeNull();
    expect(routeOnMap(map, "gate", "junction", true)).toBeNull();
  });
  it("prevents self edges and updates accessibility on duplicate connections", () => {
    expect(addConnection([], "gate", "gate", true)).toEqual([]);
    const edges = addConnection([], "gate", "library", false);
    expect(addConnection(edges, "library", "gate", true)).toEqual([
      manualEdge("gate", "library", true),
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
});
