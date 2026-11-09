import { describe, expect, it } from "vitest";
import { analyzeLayout } from "./index";
import { cleanLegendName } from "./palette";
import type { OCRLine, PixelImage } from "../types";

function image(width = 400, height = 300): PixelImage {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(255),
  };
}
function fill(
  img: PixelImage,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: number[],
) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++)
      img.data.set([...rgb, 255], (yy * img.width + xx) * 4);
}
function line(
  text: string,
  x: number,
  y: number,
  width = 70,
  height = 8,
  confidence = 92,
): OCRLine {
  return {
    text,
    confidence,
    bbox: { x0: x, y0: y, x1: x + width, y1: y + height },
    words: [],
  };
}
function colorFixture(shared = false) {
  const img = image();
  const colors = [
    [240, 80, 90],
    [45, 150, 90],
    [80, 120, 230],
    [210, 150, 40],
    [150, 60, 180],
  ];
  if (shared) colors[1] = colors[0];
  const lines: OCRLine[] = [];
  colors.forEach((color, i) => {
    fill(img, 300, 80 + i * 30, 8, 8, color);
    fill(img, 30 + i * 40, 100, 22, 22, color);
    lines.push(line(`L${i} - Library ${i}`, 312, 80 + i * 30));
  });
  return { image: img, lines };
}

describe("source-derived layout candidates", () => {
  it("never selects hardcoded campuses from an upload filename", () => {
    for (const name of [
      "science-faculty-map.jpg",
      "1792510487214.jpg",
      "jamestown.png",
    ]) {
      const input = { image: image(), lines: [], name };
      const result = analyzeLayout(input);
      expect(result.labels).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.candidateRegions).toEqual([]);
    }
  });

  it("matches distinct color legends in source pixel coordinates without letterboxing", () => {
    const result = analyzeLayout(colorFixture());
    expect(result.labels).toHaveLength(5);
    expect(result.labels[0]).toMatchObject({
      text: "Library 0",
      x: 41,
      y: 111,
      source: "legend",
    });
    expect(result.unresolvedLabels).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("retains both labels when legend colors are ambiguous", () => {
    const result = analyzeLayout(colorFixture(true));
    expect(result.labels).toHaveLength(3);
    expect(result.unresolvedLabels.map((l) => l.text)).toEqual([
      "Library 0",
      "Library 1",
    ]);
    expect(
      result.unresolvedLabels.every((l) => l.reason === "ambiguous-color"),
    ).toBe(true);
  });

  it("matches arbitrary directory keys to observed markers, keeping unmatched names", () => {
    const img = image();
    fill(img, 40, 80, 50, 40, [50, 140, 210]);
    const result = analyzeLayout({
      image: img,
      lines: [
        line("A2", 60, 95, 10),
        line("A2. Optics Centre", 20, 235, 140),
        line("B3. Biology Centre", 20, 250, 140),
        line("C4. Student Services", 20, 265, 150),
      ],
    });
    expect(result.labels).toEqual([
      {
        text: "Optics Centre",
        x: 65,
        y: 99,
        source: "legend",
        number: "A2",
        confidence: 92,
      },
    ]);
    expect(result.unresolvedLabels.map((l) => l.text)).toEqual([
      "Biology Centre",
      "Student Services",
    ]);
  });

  it("withholds duplicate key locations instead of guessing a building", () => {
    const result = analyzeLayout({
      image: image(),
      lines: [
        line("1", 50, 90, 8),
        line("1", 200, 100, 8),
        line("1. Library", 30, 250, 100),
      ],
    });
    expect(result.labels).toEqual([]);
    expect(result.unresolvedLabels).toEqual([
      { text: "Library", confidence: 92, reason: "ambiguous-key" },
    ]);
  });

  it("does not fabricate building names or paths from unlabeled shapes", () => {
    const img = image();
    fill(img, 80, 70, 220, 130, [160, 160, 160]);
    const result = analyzeLayout({ image: img, lines: [] });
    expect(result.candidateRegions.length).toBeGreaterThan(0);
    expect(result.labels).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("keeps sealed room labels without creating paths through walls", () => {
    const img = image(200, 150);
    const wall = (x: number, y: number, w: number, h: number) =>
      fill(img, x, y, w, h, [20, 20, 20]);
    wall(10, 10, 181, 3);
    wall(10, 138, 181, 3);
    wall(10, 10, 3, 131);
    wall(188, 10, 3, 131);
    wall(10, 70, 181, 3);
    wall(70, 10, 3, 61);
    wall(130, 10, 3, 61);
    const result = analyzeLayout({
      image: img,
      lines: [
        line("Room 101", 25, 30, 35, 10),
        line("Lab 102", 85, 30, 35, 10),
        line("Conference Hall", 145, 30, 40, 10),
        line("Study Corridor", 60, 100, 60, 10),
      ],
    });
    expect(result.layoutKind).toBe("floorplan");
    expect(result.labels).toHaveLength(4);
    expect(result.candidateRegions.length).toBeGreaterThanOrEqual(3);
    expect(result.labels[0]).toMatchObject({ x: 42.5, y: 35 });
    expect(result.edges).toEqual([]);
  });

  it("detects alphanumeric room codes like L201, L202 in floor plans", () => {
    const img = image(200, 150);
    const wall = (x: number, y: number, w: number, h: number) =>
      fill(img, x, y, w, h, [20, 20, 20]);
    wall(10, 10, 181, 3);
    wall(10, 138, 181, 3);
    wall(10, 10, 3, 131);
    wall(188, 10, 3, 131);
    wall(10, 70, 181, 3);
    wall(70, 10, 3, 61);
    wall(130, 10, 3, 61);
    const result = analyzeLayout({
      image: img,
      lines: [
        line("Lower Level - 2", 50, 140, 90, 8),
        line("L201", 25, 30, 30, 10),
        line("L202", 85, 30, 30, 10),
        line("L204", 145, 30, 30, 10),
      ],
    });
    expect(result.layoutKind).toBe("floorplan");
    expect(result.labels.map((l) => l.text)).toEqual(["L201", "L202", "L204"]);
  });

  it("preserves Tamil, Sinhala, Hindi and Arabic text in directory matching", () => {
    const names = ["நூலகம்", "පුස්තකාලය", "पुस्तकालय", "المكتبة"];
    const lines = names.flatMap((name, i) => [
      line(String(i + 1), 40 + i * 60, 90, 10),
      line(`${i + 1}. ${name}`, 30, 230 + i * 12, 140),
    ]);
    const result = analyzeLayout({ image: image(), lines });
    expect(result.labels.map((l) => l.text)).toEqual(names);
    expect(cleanLegendName("A1 - நூலகம்")).toBe("நூலகம்");
    expect(cleanLegendName("Research-and-Teaching Centre")).toBe(
      "Research-and-Teaching Centre",
    );
  });

  it("ignores invalid OCR geometry and rejects invalid image buffers", () => {
    const invalid = line("Library", 10, 20);
    invalid.bbox.x0 = NaN;
    expect(analyzeLayout({ image: image(), lines: [invalid] }).labels).toEqual(
      [],
    );
    expect(() =>
      analyzeLayout({
        image: { width: 400, height: 300, data: new Uint8ClampedArray(1) },
        lines: [],
      }),
    ).toThrow("Invalid layout pixels");
  });

  it("ignores fully transparent color pixels", () => {
    const img = image();
    fill(img, 80, 70, 50, 50, [30, 150, 200]);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 0;
    expect(analyzeLayout({ image: img, lines: [] }).candidateRegions).toEqual(
      [],
    );
  });

  it.each([
    "SCIENCE FACULTY MAP",
    "University of Jamestown",
    "Faculty of Applied Sciences",
  ])("does not invent a campus from the title %s", (title) => {
    for (const [width, height] of [
      [768, 1024],
      [600, 300],
      [300, 600],
    ]) {
      const result = analyzeLayout({
        image: image(width, height),
        lines: [line(title, 15, 15, 220, 15)],
        name: title + ".png",
      });
      expect(result.labels).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.candidateRegions).toEqual([]);
    }
  });
  it.each(["Lower Level - 2.png", "photo.png"])(
    "keeps observed indoor labels without a preset: %s",
    (name) => {
      const text = [
        "LOWER LEVEL - 2",
        "YOU ARE HERE",
        "ACADEMIC STAFF",
        "LECTURE HALLS",
        "COMPUTER ROOM",
        "STAFF DINING & RESTROOM",
        "L202",
        "L203",
      ];
      const result = analyzeLayout({
        image: image(768, 1024),
        name,
        lines: text.map((t, i) => line(t, 60, 40 + i * 35, 240, 15)),
      });
      expect(result.labels.every((l) => text.includes(l.text))).toBe(true);
      expect(result.labels.length).toBeLessThanOrEqual(text.length);
      expect(result.edges).toEqual([]);
    },
  );
  it("does not generate a known floor plan from a filename and generic room text", () => {
    const result = analyzeLayout({
      image: image(768, 1024),
      name: "Lower Level - 2.jpg",
      lines: [line("Lecture Hall", 100, 200)],
    });
    expect(result.labels.every((l) => l.text === "Lecture Hall")).toBe(true);
    expect(result.edges).toEqual([]);
  });
});
