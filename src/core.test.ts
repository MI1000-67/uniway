import { describe, expect, it, vi, afterEach } from "vitest";
import {
  edges,
  entrances,
  nodes,
  places,
  searchPlaces,
  SAMPLE_QR,
} from "./campus";
import { findRoute } from "./routing";
import {
  createSession,
  formatTime,
  parseQR,
  parseSession,
  remainingTime,
  SESSION_DURATION,
} from "./session";
import { validateImage } from "./uploads";

describe("campus navigation", () => {
  it("finds the library from any entrance and only follows connected paths", () => {
    for (const entrance of entrances) {
      const route = findRoute(entrance.id, "library-door", false)!;
      expect(route.points[0].id).toBe(entrance.id);
      expect(route.points.at(-1)?.id).toBe("library-door");
      expect(route.meters).toBeGreaterThan(0);
      route.points
        .slice(1)
        .forEach((node, i) =>
          expect(
            edges.some(
              (e) =>
                (e.from === route.points[i].id && e.to === node.id) ||
                (e.to === route.points[i].id && e.from === node.id),
            ),
          ).toBe(true),
        );
    }
  });
  it("uses the library ramp when a step-free path is requested", () => {
    const ordinary = findRoute("west-gate", "library-door", false)!;
    const accessible = findRoute("west-gate", "library-door", true)!;
    expect(ordinary.points.some((p) => p.id === "455-420")).toBe(true);
    expect(accessible.points.some((p) => p.id === "library-ramp")).toBe(true);
    expect(accessible.meters).toBeGreaterThan(ordinary.meters);
    accessible.points
      .slice(1)
      .forEach((node, i) =>
        expect(
          edges.some(
            (e) =>
              e.stepFree &&
              ((e.from === accessible.points[i].id && e.to === node.id) ||
                (e.to === accessible.points[i].id && e.from === node.id)),
          ),
        ).toBe(true),
      );
  });
  it("provides step-free routes to every place from every entrance", () => {
    for (const entrance of entrances)
      for (const place of places)
        expect(
          findRoute(entrance.id, place.nodeId, true),
          `${entrance.name} → ${place.name}`,
        ).not.toBeNull();
  });
  it("reports disconnected and unknown destinations", () => {
    expect(
      findRoute("south-gate", "library-door", false, nodes, []),
    ).toBeNull();
    expect(findRoute("unknown", "library-door", false)).toBeNull();
  });
  it("chooses the shortest weighted path rather than the fewest edges", () => {
    const graph = [
      { id: "a", x: 0, y: 0, landmark: "A" },
      { id: "b", x: 1, y: 0, landmark: "B" },
      { id: "c", x: 2, y: 0, landmark: "C" },
      { id: "d", x: 1, y: 10, landmark: "D" },
      { id: "e", x: 3, y: 0, landmark: "E" },
    ];
    const links = [
      ["a", "b"],
      ["b", "c"],
      ["c", "e"],
      ["a", "d"],
      ["d", "e"],
    ].map(([from, to]) => ({ from, to, stepFree: true }));
    expect(
      findRoute("a", "e", false, graph, links)?.points.map((p) => p.id),
    ).toEqual(["a", "b", "c", "e"]);
  });
  it("handles a starting point already at the destination", () => {
    const route = findRoute("library-door", "library-door", true)!;
    expect(route.meters).toBe(0);
    expect(route.minutes).toBe(0);
    expect(route.instructions[0]).toMatch(/already/);
  });
  it("supports case-insensitive search, descriptive terms, and combined category filters", () => {
    expect(searchPlaces(" LIBRARY ", "All").map((p) => p.id)).toEqual([
      "library",
    ]);
    expect(searchPlaces("coffee", "Food").map((p) => p.id)).toEqual(["cafe"]);
    expect(searchPlaces("library", "Parking")).toEqual([]);
    expect(searchPlaces("no such place", "All")).toEqual([]);
  });
});

describe("visitor sessions", () => {
  afterEach(() => vi.useRealTimers());
  it("expires three hours after creation, independent of timer frequency", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
    const session = createSession("south-gate");
    expect(remainingTime(session)).toBe(SESSION_DURATION);
    vi.setSystemTime(new Date("2026-10-13T11:59:59Z"));
    expect(remainingTime(session)).toBe(1000);
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    expect(remainingTime(session)).toBe(0);
  });
  it("preserves the deadline across storage/reload and a sleeping device", () => {
    const session = createSession("west-gate", 1000);
    const restored = parseSession(JSON.stringify(session))!;
    expect(restored).toEqual(session);
    expect(remainingTime(restored, 1000 + SESSION_DURATION + 60000)).toBe(0);
  });
  it("rejects corrupt or unrelated session metadata", () => {
    for (const raw of [
      null,
      "{",
      "null",
      "{}",
      JSON.stringify({
        campusId: "other",
        entranceId: "south-gate",
        expiresAt: 1000,
      }),
      JSON.stringify({
        campusId: "willowbrook",
        entranceId: "unknown",
        expiresAt: 1000,
      }),
    ])
      expect(parseSession(raw)).toBeNull();
  });
  it("formats countdown boundaries", () => {
    expect(formatTime(SESSION_DURATION)).toBe("03:00:00");
    expect(formatTime(1001)).toBe("00:00:02");
    expect(formatTime(0)).toBe("00:00:00");
    expect(formatTime(-20)).toBe("00:00:00");
  });
});
describe("QR entrance recognition", () => {
  it("accepts only the supported campus entrance format", () => {
    expect(parseQR(SAMPLE_QR)).toBe("south-gate");
    expect(parseQR(" uniway://willowbrook/west-gate ")).toBe("west-gate");
    for (const code of [
      "https://example.com",
      "javascript:alert(1)",
      "uniway://other/south-gate",
      "uniway://willowbrook/unknown",
      "uniway://willowbrook/south-gate?redirect=https://example.com",
      "uniway://name@willowbrook/south-gate",
      "not a code",
    ])
      expect(parseQR(code)).toBeNull();
  });
});
describe("upload validation", () => {
  it("accepts supported image types", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"])
      expect(validateImage({ type, size: 1024 })).toBeNull();
  });
  it("rejects unsupported, empty, or oversized files", () => {
    expect(validateImage({ type: "image/svg+xml", size: 1024 })).toMatch(
      /JPEG/,
    );
    expect(validateImage({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(
      validateImage({ type: "image/png", size: 16 * 1024 * 1024 }),
    ).toMatch(/large/);
  });
});
