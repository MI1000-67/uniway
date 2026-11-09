import { describe, expect, it } from "vitest";
import { appViewUrl, ocrAssetBase, readAppView } from "./appUrl";

describe("static hosting URLs", () => {
  it("keeps module navigation inside the deployment base", () => {
    expect(appViewUrl("navigate", "/uniway/")).toBe("/uniway/");
    expect(appViewUrl("connect", "/uniway/")).toBe("/uniway/#/connect");
    expect(appViewUrl("connect", "/")).toBe("/#/connect");
  });

  it("resolves a refreshed hash route without matching unrelated fragments", () => {
    expect(readAppView({ pathname: "/uniway/", hash: "#/connect" })).toBe(
      "connect",
    );
    expect(readAppView({ pathname: "/", hash: "#disconnect" })).toBe(
      "navigate",
    );
    expect(readAppView({ pathname: "/connect", hash: "" })).toBe("connect");
  });

  it("loads OCR assets from this host and deployment base", () => {
    const base = ocrAssetBase("https://example.test", "/uniway/");
    expect(new URL("lang/eng.traineddata", base).href).toBe(
      "https://example.test/uniway/ocr/lang/eng.traineddata",
    );
    expect(ocrAssetBase("http://localhost:5173", "/").href).toBe(
      "http://localhost:5173/ocr/",
    );
  });
});
