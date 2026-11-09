import { places } from "./campus";

/** A label is display text, never an identity or evidence of a route. */
export type LocationReference = {
  mapId: string;
  mapVersion: number;
  placeId: string;
};

export const DEMO_MAP_ID = "willowbrook";
export const DEMO_MAP_VERSION = 1;

export function demoLocation(placeId: string): LocationReference {
  return { mapId: DEMO_MAP_ID, mapVersion: DEMO_MAP_VERSION, placeId };
}

/** Imported map references are reserved for a later, explicitly verified integration. */
export function resolveDemoLocation(location?: LocationReference) {
  if (
    !location ||
    location.mapId !== DEMO_MAP_ID ||
    location.mapVersion !== DEMO_MAP_VERSION
  )
    return null;
  return places.find((p) => p.id === location.placeId) ?? null;
}

export const campusLocations = [
  "science",
  "library",
  "cafe",
  "engineering",
  "student",
  "arts",
]
  .map((id) => places.find((p) => p.id === id)!)
  .map((place) => ({ id: place.id, name: place.name }));
