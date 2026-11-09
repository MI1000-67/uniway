import type heic2anyType from "heic2any";

/**
 * Checks whether a given file is a HEIC/HEIF image by inspecting its MIME type
 * or its filename extension.
 *
 * This dual check handles Windows and Linux Chromium-based browsers that report
 * an empty `file.type` for `.heic` and `.heif` files.
 */
export function isHeicFile(
  file?: { name?: string; type?: string } | null,
): boolean {
  if (!file) return false;
  const type = (file.type || "").toLowerCase().trim();
  if (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence"
  ) {
    return true;
  }
  const name = (file.name || "").trim();
  return /\.hei[cf]$/i.test(name);
}

/**
 * Converts a HEIC or HEIF File or Blob to a standard `image/jpeg` Blob using
 * client-side `heic2any`.
 *
 * Runs entirely in-browser using an internal Web Worker, requiring zero external
 * network calls and conforming strictly to local origin policies.
 */
export async function convertHeicToJpegBlob(
  file: File | Blob,
  quality = 0.92,
): Promise<Blob> {
  if (!file || !(file instanceof Blob)) {
    throw new Error("Invalid input: Expected a File or Blob.");
  }

  try {
    const mod = await import("heic2any");
    const heic2any: typeof heic2anyType =
      typeof mod.default === "function"
        ? mod.default
        : (mod as unknown as typeof heic2anyType);

    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality,
    });

    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob) {
      throw new Error("HEIC conversion returned no image data.");
    }
    return blob;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to convert HEIC image to JPEG.";
    throw new Error(`HEIC conversion failed: ${message}`);
  }
}
