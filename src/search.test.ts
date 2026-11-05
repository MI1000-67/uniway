import { describe, expect, it } from "vitest";
import { searchPlaces } from "./campus";
import { matchesPlace, searchMatchingPlaces } from "./search";

describe("local place search", () => {
  it("folds accents and accepts a published alias or one-letter typo", () => {
    const cafe = { name: "Café Terrace", aliases: ["Canteen"] };
    expect(matchesPlace(cafe, "cafe")).toBe(true);
    expect(matchesPlace(cafe, "cafe\u0301")).toBe(true);
    expect(matchesPlace(cafe, "canteeen")).toBe(true);
    expect(matchesPlace({ name: "Central Library" }, "libary")).toBe(true);
    expect(matchesPlace({ name: "Central Library" }, "librayr")).toBe(true);
    expect(matchesPlace(cafe, "laboratory")).toBe(false);
  });

  it("searches Tamil, Sinhala, Hindi, and Arabic without deleting their vowel marks", () => {
    for (const name of ["நூலகம்", "පුස්තකාලය", "पुस्तकालय", "المكتبة"])
      expect(matchesPlace({ name }, name)).toBe(true);
    expect(matchesPlace({ name: "மலை" }, "மல")).toBe(true);
    // Removing the vowel sign changes the word; it must not become an exact match.
    expect(matchesPlace({ name: "கால்" }, "கல்")).toBe(false);
    expect(matchesPlace({ name: "පාලම" }, "පලම")).toBe(false);
  });

  it("matches words in any order, short names, and punctuation boundaries", () => {
    const place = {
      name: "School of Science",
      shortName: "Science Faculty",
      description: "Laboratories beside Founders’ Square.",
      category: "Teaching",
    };
    expect(matchesPlace(place, "faculty sci")).toBe(true);
    expect(matchesPlace(place, "science teaching")).toBe(true);
    expect(matchesPlace(place, "founders square")).toBe(true);
    expect(matchesPlace(place, "science unknown")).toBe(false);
  });

  it("does not turn short words, numeric labels, or interior substrings into false matches", () => {
    expect(matchesPlace({ name: "Cat" }, "car")).toBe(false);
    expect(matchesPlace({ name: "Party Hall" }, "art")).toBe(false);
    expect(matchesPlace({ name: "Building C22" }, "c2")).toBe(false);
    expect(matchesPlace({ name: "Room 10" }, "room 1")).toBe(false);
    expect(matchesPlace({ name: "Room 10" }, "room 11")).toBe(false);
    expect(
      matchesPlace({ name: "Medical Centre", labelNumber: "23" }, "23"),
    ).toBe(true);
  });

  it("requires an exact or prefix match for descriptive text", () => {
    const place = { name: "East Hall", description: "The library is nearby." };
    expect(matchesPlace(place, "library")).toBe(true);
    expect(matchesPlace(place, "libary")).toBe(false);
  });

  it("ranks exact names and aliases ahead of prefixes and typo matches", () => {
    const places = [
      { id: "typo", name: "Libary" },
      { id: "prefix", name: "Library Annex" },
      { id: "alias", name: "Central Reading Room", aliases: ["Library"] },
      { id: "exact", name: "Library" },
      {
        id: "description",
        name: "East Hall",
        description: "Beside the library",
      },
    ];
    expect(searchMatchingPlaces(places, "library").map((p) => p.id)).toEqual([
      "exact",
      "alias",
      "prefix",
      "description",
      "typo",
    ]);
    expect(places[0].id).toBe("typo");
  });

  it("keeps source order for equally relevant results and empty queries", () => {
    const places = [{ name: "Library East" }, { name: "Library West" }];
    expect(searchMatchingPlaces(places, "library")).toEqual(places);
    expect(searchMatchingPlaces(places, " \n ")).toEqual(places);
    expect(searchMatchingPlaces(places, "!@#$")).toEqual(places);
    expect(searchMatchingPlaces(places, "unknown")).toEqual([]);
  });

  it("uses aliases and typo tolerance in campus search while respecting category filters", () => {
    expect(searchPlaces("cafe", "All").map((p) => p.id)).toEqual(["cafe"]);
    expect(searchPlaces("canteeen", "Food").map((p) => p.id)).toEqual(["cafe"]);
    expect(searchPlaces("libary", "All").map((p) => p.id)).toEqual(["library"]);
    expect(searchPlaces("washroom", "Toilets").map((p) => p.id)).toEqual([
      "toilets",
    ]);
    expect(searchPlaces("library", "Parking")).toEqual([]);
  });
});
