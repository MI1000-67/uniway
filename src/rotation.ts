import type { Point } from "./campus";
/** Convert a screen-aligned displacement into unrotated map coordinates. */
export function unrotate(x: number, y: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: x * Math.cos(radians) + y * Math.sin(radians),
    y: -x * Math.sin(radians) + y * Math.cos(radians),
  };
}
