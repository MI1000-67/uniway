import { CAMPUS_ID, entrances } from "./campus";
export const SESSION_KEY = "uniway.visitor.v1";
export const SESSION_DURATION = 3 * 60 * 60 * 1000;
export type VisitorSession = {
  campusId: string;
  entranceId: string;
  expiresAt: number;
};
export function createSession(
  entranceId: string,
  now = Date.now(),
): VisitorSession {
  return { campusId: CAMPUS_ID, entranceId, expiresAt: now + SESSION_DURATION };
}
export function remainingTime(session: VisitorSession, now = Date.now()) {
  return Math.max(0, session.expiresAt - now);
}
export function formatTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
export function parseSession(raw: string | null): VisitorSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v &&
      v.campusId === CAMPUS_ID &&
      entrances.some((e) => e.id === v.entranceId) &&
      Number.isFinite(v.expiresAt)
      ? v
      : null;
  } catch {
    return null;
  }
}
export function parseQR(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "uniway:" ||
      url.hostname !== CAMPUS_ID ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      return null;
    const id = url.pathname.slice(1);
    return entrances.some((e) => e.id === id) ? id : null;
  } catch {
    return null;
  }
}
