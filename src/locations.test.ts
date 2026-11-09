import { describe, expect, it } from "vitest";
import {
  campusLocations,
  demoLocation,
  resolveDemoLocation,
} from "./locations";
import {
  initialCommunityPosts,
  initialVolunteerOpportunities,
} from "./connect/mockData";

describe("verified location references", () => {
  it("resolves picker and seeded references to real demo destinations", () => {
    for (const item of campusLocations)
      expect(resolveDemoLocation(demoLocation(item.id))?.id).toBe(item.id);
    for (const item of [
      ...initialCommunityPosts,
      ...initialVolunteerOpportunities,
    ]) {
      if (item.location)
        expect(resolveDemoLocation(item.location)).not.toBeNull();
    }
    expect(resolveDemoLocation(demoLocation("student"))?.name).toBe(
      "Student Centre",
    );
  });
  it("rejects missing, stale, imported and unknown references without guessing from names", () => {
    expect(resolveDemoLocation()).toBeNull();
    expect(resolveDemoLocation(demoLocation("sports"))).toBeNull();
    expect(resolveDemoLocation(demoLocation("student-centre"))).toBeNull();
    expect(
      resolveDemoLocation({ ...demoLocation("library"), mapVersion: 999 }),
    ).toBeNull();
    expect(
      resolveDemoLocation({
        ...demoLocation("library"),
        mapId: "uploaded-map",
      }),
    ).toBeNull();
    expect(
      initialVolunteerOpportunities.find((o) =>
        o.locationName.includes("Sports Ground"),
      )?.location,
    ).toBeUndefined();
  });
});
