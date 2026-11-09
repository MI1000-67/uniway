export type AppView = "navigate" | "connect";

/** Hash routes work after refresh on static hosts, including project subpaths. */
export function readAppView(
  location: Pick<Location, "pathname" | "hash">,
): AppView {
  return location.hash === "#/connect" ||
    location.hash === "#connect" ||
    location.pathname === "/connect"
    ? "connect"
    : "navigate";
}

export function appViewUrl(
  view: AppView,
  base = import.meta.env.BASE_URL,
): string {
  return `${base}${view === "connect" ? "#/connect" : ""}`;
}

export function ocrAssetBase(
  origin: string,
  base = import.meta.env.BASE_URL,
): URL {
  return new URL(`${base}ocr/`, origin);
}
