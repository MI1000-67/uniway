export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  return ((degrees % 360) + 360) % 360;
}

/** Clockwise angle from image-up to its printed north arrow. */
export function northUpRotation(northOffset: number): number {
  return normalizeDegrees(-northOffset);
}

export function headingUpRotation(
  heading: number,
  northOffset: number,
): number {
  return normalizeDegrees(-heading - northOffset);
}

export function compassDirection(heading: number): string {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.round(normalizeDegrees(heading) / 45) % 8
  ];
}

export type CompassReading = {
  absolute?: boolean;
  alpha: number | null;
  beta?: number | null;
  gamma?: number | null;
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

/** A level-device heading only. Relative alpha has an arbitrary origin. */
export function headingFromOrientation(
  event: CompassReading,
  screenAngle = 0,
): number | null {
  if (
    (typeof event.beta === "number" &&
      (!Number.isFinite(event.beta) || Math.abs(event.beta) > 45)) ||
    (typeof event.gamma === "number" &&
      (!Number.isFinite(event.gamma) || Math.abs(event.gamma) > 45))
  )
    return null;
  if (
    typeof event.webkitCompassHeading === "number" &&
    Number.isFinite(event.webkitCompassHeading) &&
    !(
      typeof event.webkitCompassAccuracy === "number" &&
      (event.webkitCompassAccuracy < 0 || event.webkitCompassAccuracy > 45)
    )
  )
    return normalizeDegrees(event.webkitCompassHeading + screenAngle);
  if (
    event.absolute === true &&
    typeof event.alpha === "number" &&
    Number.isFinite(event.alpha) &&
    typeof event.beta === "number" &&
    typeof event.gamma === "number"
  )
    return normalizeDegrees(360 - event.alpha + screenAngle);
  return null;
}
