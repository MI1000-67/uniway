import { detectedEdge } from "../mapEdges";
import { describe, expect, it } from "vitest";
import {
  assessQuality,
  attachPlaces,
  cleanNumberBadge,
  extractIndoorLinework,
  extractLabels,
  extractLinework,
  findNumberBadges,
  hasLineOfSight,
  simplifyLinework,
} from "./core";
import type { PixelImage, OCRLine } from "./types";
import { findRouteAlternatives } from "../routeAlternatives";
import { detectWalls } from "./imported/floorplan";

function image(width = 200, height = 200): PixelImage {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(255),
  };
}
function line(text: string, x: number, y: number): OCRLine {
  return {
    text,
    confidence: 95,
    bbox: { x0: x, y0: y, x1: x + 120, y1: y + 12 },
    words: [],
  };
}
describe("local extraction boundaries", () => {
  it("does not turn a blank page into places or a navigation graph", () => {
    const blank = image();
    expect(extractLinework(blank).edges).toHaveLength(0);
    expect(extractLabels([], [], 200, 200)).toHaveLength(0);
    expect(assessQuality(blank, []).level).toBe("limited");
  });
  it("does not mistake a solid gray building for a walking network", () => {
    const pixels = image(400, 300);
    for (let y = 70; y < 200; y++)
      for (let x = 80; x < 300; x++)
        pixels.data.set([160, 160, 160, 255], (y * 400 + x) * 4);
    expect(extractLinework(pixels).edges).toHaveLength(0);
  });
  it("associates a numbered key with a marker instead of placing pins in the legend", () => {
    const labels = extractLabels(
      [
        line("1. Library", 100, 800),
        line("2. Laboratory", 100, 820),
        line("3. Office", 100, 840),
      ],
      [{ number: "1", x: 250, y: 200, confidence: 92 }],
      1000,
      1000,
    );
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({
      text: "Library",
      x: 250,
      y: 200,
      source: "legend",
    });
  });
  it("withholds ambiguous duplicate number assignments", () => {
    const labels = extractLabels(
      [
        line("1. Library", 100, 800),
        line("2. Laboratory", 100, 820),
        line("3. Office", 100, 840),
      ],
      [
        { number: "1", x: 250, y: 200, confidence: 92 },
        { number: "1", x: 600, y: 300, confidence: 90 },
      ],
      1000,
      1000,
    );
    expect(labels).toHaveLength(0);
  });
  it("never creates an off-network connector or claims step-free access", () => {
    const graph = attachPlaces(
      [{ text: "Library", x: 900, y: 900, confidence: 95, source: "label" }],
      {
        nodes: [
          { id: "a", x: 0, y: 0, landmark: "Path" },
          { id: "b", x: 50, y: 0, landmark: "Path" },
        ],
        edges: [{ from: "a", to: "b", stepFree: false }],
      },
      1000,
      1000,
    );
    expect(graph.edges).toEqual([
      detectedEdge({ from: "a", to: "b", stepFree: false }),
    ]);
    expect(
      findRouteAlternatives(
        "a",
        graph.places[0].nodeId,
        false,
        graph.nodes,
        graph.edges,
      ),
    ).toEqual([]);
    expect(graph.places[0].labelPoint).toEqual({ x: 900, y: 900 });
  });
  it("simplifies straight samples while retaining a closed-loop alternative", () => {
    const nodes = [
      { id: "a", x: 0, y: 0, landmark: "A" },
      { id: "b", x: 10, y: 0, landmark: "B" },
      { id: "c", x: 20, y: 0, landmark: "C" },
      { id: "d", x: 20, y: 20, landmark: "D" },
      { id: "e", x: 0, y: 20, landmark: "E" },
    ];
    const edges = [
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
      ["d", "e"],
      ["e", "a"],
    ].map(([from, to]) => ({ from, to, stepFree: false }));
    const result = simplifyLinework(nodes, edges);
    expect(result.nodes.length).toBeLessThan(nodes.length);
    expect(
      findRouteAlternatives("a", "d", false, result.nodes, result.edges),
    ).toHaveLength(2);
  });
  it("extracts warm beige and tan walkways into a traversable path graph", () => {
    const pixels = image(400, 300);
    // Draw a beige/tan pathway network across the map (color 190, 180, 160)
    for (let x = 40; x < 360; x++) {
      for (let y = 148; y <= 153; y++) {
        pixels.data.set([190, 180, 160, 255], (y * 400 + x) * 4);
      }
    }
    for (let y = 50; y < 250; y++) {
      for (let x = 198; x <= 203; x++) {
        pixels.data.set([190, 180, 160, 255], (y * 400 + x) * 4);
      }
    }
    const linework = extractLinework(pixels);
    expect(linework.nodes.length).toBeGreaterThan(0);
    expect(linework.edges.length).toBeGreaterThan(0);
  });
  it("detects white digits on dark building backgrounds and normalizes polarity for OCR", () => {
    const pixels = image(200, 200);
    // Draw a dark building (80, 20, 10)
    for (let y = 40; y < 90; y++) {
      for (let x = 40; x < 100; x++) {
        pixels.data.set([80, 20, 10, 255], (y * 200 + x) * 4);
      }
    }
    // Draw white digits inside the building
    for (let y = 60; y <= 70; y++) {
      for (let x = 65; x <= 67; x++) {
        pixels.data.set([255, 255, 255, 255], (y * 200 + x) * 4);
      }
    }
    const badges = findNumberBadges(pixels);
    expect(badges.length).toBeGreaterThan(0);
    const cleaned = cleanNumberBadge(pixels, badges[0]);
    // The digit should be rendered black (0, 0, 0) on white (255)
    let hasBlack = false;
    for (let i = 0; i < cleaned.data.length; i += 4) {
      if (cleaned.data[i] === 0) hasBlack = true;
    }
    expect(hasBlack).toBe(true);
  });
  it("associates bulleted sub-locations in the key as aliases of the parent building", () => {
    const labels = extractLabels(
      [
        line("12. Liechty Center Taber Hall", 100, 800),
        line("+ Admissions", 100, 815),
        line("+ Campus Ministry", 100, 830),
      ],
      [{ number: "12", x: 220, y: 220, confidence: 95 }],
      1000,
      1000,
    );
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe("Liechty Center Taber Hall");
    expect(labels[0].aliases).toEqual(["Admissions", "Campus Ministry"]);
  });

  it("verifies line of sight and prevents connecting through walls", () => {
    const wallMask = new Uint8Array(100 * 100);
    // Draw vertical wall at x=50 from y=0 to y=100
    for (let y = 0; y < 100; y++) {
      wallMask[y * 100 + 50] = 1;
    }
    // Path crossing wall from x=20 to x=80 must fail
    expect(hasLineOfSight(20, 50, 80, 50, wallMask, 100, 100)).toBe(false);
    // Path on same side of wall from (20, 20) to (20, 80) must pass
    expect(hasLineOfSight(20, 20, 20, 80, wallMask, 100, 100)).toBe(true);
    expect(hasLineOfSight(-1, 20, 20, 20, wallMask, 100, 100)).toBe(false);
    expect(hasLineOfSight(NaN, 20, 20, 20, wallMask, 100, 100)).toBe(false);
  });

  it.each([false, true])(
    "retains doorway connectivity only when an opening exists: %s",
    (door) => {
      const pixels = image(240, 180);
      const wall = (x: number, y: number, w: number, h: number) => {
        for (let yy = y; yy < y + h; yy++)
          for (let xx = x; xx < x + w; xx++)
            pixels.data.set([20, 20, 20, 255], (yy * 240 + xx) * 4);
      };
      wall(10, 10, 220, 4);
      wall(10, 166, 220, 4);
      wall(10, 10, 4, 160);
      wall(226, 10, 4, 160);
      wall(118, 10, 4, door ? 65 : 160);
      if (door) wall(118, 105, 4, 65);
      const graph = extractIndoorLinework(pixels, [
        { x: 30, y: 70, width: 40, height: 40 },
        { x: 170, y: 70, width: 40, height: 40 },
      ]);
      const walls = detectWalls(pixels);
      for (const edge of graph.edges) {
        const a = graph.nodes.find((n) => n.id === edge.from)!;
        const b = graph.nodes.find((n) => n.id === edge.to)!;
        expect(hasLineOfSight(a.x, a.y, b.x, b.y, walls, 240, 180)).toBe(true);
        expect(edge.stepFree).toBe(false);
      }
      const routes = findRouteAlternatives(
        "room-node-0",
        "room-node-1",
        false,
        graph.nodes,
        graph.edges,
      );
      expect(routes.length > 0).toBe(door);
    },
  );

  it("does not attach an indoor label to a nearby path across a wall", () => {
    const walls = new Uint8Array(200 * 200);
    for (let y = 0; y < 200; y++) walls[y * 200 + 100] = 1;
    const graph = attachPlaces(
      [{ text: "Lab", x: 90, y: 100, confidence: 95, source: "label" }],
      {
        nodes: [{ id: "corridor", x: 110, y: 100, landmark: "Corridor" }],
        edges: [],
      },
      200,
      200,
      (label, node) =>
        hasLineOfSight(label.x, label.y, node.x, node.y, walls, 200, 200),
    );
    expect(graph.places[0].nodeId).not.toBe("corridor");
    expect(graph.edges).toEqual([]);
  });

  it("extracts indoor corridor linework without crossing walls", () => {
    const pixels = image(200, 200);
    const wall = (x0: number, y0: number, w: number, h: number) => {
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          pixels.data.set([20, 20, 20, 255], (y * 200 + x) * 4);
        }
      }
    };
    // Border walls
    wall(10, 10, 180, 4);
    wall(10, 186, 180, 4);
    wall(10, 10, 4, 180);
    wall(186, 10, 4, 180);
    // Middle dividing wall with a corridor below it
    wall(10, 95, 180, 4);
    // Vertical room divider with doorway
    wall(95, 10, 4, 85);
    const linework = extractIndoorLinework(pixels, [
      { x: 20, y: 20, width: 60, height: 60 },
      { x: 110, y: 20, width: 60, height: 60 },
    ]);
    expect(linework.nodes.length).toBeGreaterThan(0);
  });
});
