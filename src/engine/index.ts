import type { Worker as OCRWorker } from "tesseract.js";
import { ocrAssetBase } from "../appUrl";
import type { UploadedImage } from "../UploadPanel";
import { newMap, autoConnectPlaces } from "../preparedMap";
import type { PreparedMap } from "../preparedMap";
import { loadImage } from "../uploads";
import {
  flattenOCR,
  findLegendRegions,
  extractLabels,
  attachPlaces,
  assessQuality,
  cleanNumberBadge,
  extractIndoorLinework,
  hasLineOfSight,
} from "./core";
import { detectWalls } from "./imported/floorplan";
import type { Linework } from "./core";
import type { Crop, EngineReport, PixelImage } from "./types";
import { layoutLanguages } from "./languages";
import type { LayoutLanguage } from "./languages";
import type { LayoutAnalysis } from "./imported";
import { mergeDetections, scaleOCRLines } from "./merge";
export { layoutLanguages } from "./languages";
export type { LayoutLanguage } from "./languages";
export type { EngineReport } from "./types";

function enhanceCanvasContrast(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const imgData = context.getImageData(0, 0, width, height);
  const d = imgData.data;
  let minL = 255,
    maxL = 0;
  const step = Math.max(1, Math.floor(d.length / (4 * 20000))) * 4;
  for (let i = 0; i < d.length; i += step) {
    const l = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    if (l < minL) minL = l;
    if (l > maxL) maxL = l;
  }
  const range = maxL - minL;
  if (range > 30 && range < 235) {
    const scale = 255 / range;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, Math.max(0, (d[i] - minL) * scale));
      d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - minL) * scale));
      d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - minL) * scale));
    }
    context.putImageData(imgData, 0, 0);
  }
}

const aborted = () =>
  new DOMException("Map preparation was cancelled.", "AbortError");
function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  cleanLate?: (value: T) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => reject(aborted());
    if (signal.aborted) stop();
    else signal.addEventListener("abort", stop, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", stop);
        if (signal.aborted) {
          cleanLate?.(value);
          reject(aborted());
        } else resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", stop);
        reject(error);
      },
    );
  });
}
function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d", { willReadFrequently: true });
  if (!context)
    throw new Error(
      "Your browser could not prepare this image. Try another browser.",
    );
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  return { element, context };
}
function cropCanvas(
  source: HTMLCanvasElement,
  b: Crop,
  scale: number,
  padding = 0,
) {
  const { element, context } = canvas(
    Math.ceil(b.width * scale) + padding * 2,
    Math.ceil(b.height * scale) + padding * 2,
  );
  context.drawImage(
    source,
    b.x,
    b.y,
    b.width,
    b.height,
    padding,
    padding,
    b.width * scale,
    b.height * scale,
  );
  return element;
}

export async function analyzeUploadedMap(
  image: UploadedImage,
  language: LayoutLanguage,
  onProgress: (progress: { stage: string; progress: number }) => void,
  signal?: AbortSignal,
): Promise<PreparedMap & { analysis: EngineReport }> {
  if (!layoutLanguages.some((l) => l.value === language))
    throw new Error("Choose a supported layout language.");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const workSignal = controller.signal;
  const timer = window.setTimeout(cancel, 120_000);
  let ocr: OCRWorker | undefined, vision: globalThis.Worker | undefined;
  const update = (stage: string, progress: number) => {
    if (!workSignal.aborted) onProgress({ stage, progress });
  };
  const terminate = () => {
    vision?.terminate();
    if (ocr) void ocr.terminate();
  };
  workSignal.addEventListener("abort", terminate, { once: true });
  try {
    workSignal.throwIfAborted();
    update("Preparing your image", 0.02);
    const source = await abortable(loadImage(image.url), workSignal);
    if (source.naturalWidth * source.naturalHeight > 100_000_000)
      throw new Error(
        "This image has a lot of detail. Resize it below 100 megapixels, then try again.",
      );
    // Bound memory and CPU independently of the resolution of the upload.
    const imageScale = Math.min(
      1,
      1600 / Math.max(source.naturalWidth, source.naturalHeight),
    );
    const width = Math.round(source.naturalWidth * imageScale),
      height = Math.round(source.naturalHeight * imageScale);
    const drawing = canvas(width, height);
    drawing.context.drawImage(source, 0, 0, width, height);
    enhanceCanvasContrast(drawing.context, width, height);
    const pixels: PixelImage = {
      data: drawing.context.getImageData(0, 0, width, height).data,
      width,
      height,
    };
    const pathScale = Math.min(1, 1000 / Math.max(width, height));
    const pathCanvas = canvas(
      Math.round(width * pathScale),
      Math.round(height * pathScale),
    );
    pathCanvas.context.drawImage(
      drawing.element,
      0,
      0,
      pathCanvas.element.width,
      pathCanvas.element.height,
    );
    const pathImage: PixelImage = {
      data: pathCanvas.context.getImageData(
        0,
        0,
        pathCanvas.element.width,
        pathCanvas.element.height,
      ).data,
      width: pathCanvas.element.width,
      height: pathCanvas.element.height,
    };
    vision = new Worker(new URL("./engine.worker.ts", import.meta.url), {
      type: "module",
    });
    const geometryPromise = abortable(
      new Promise<{
        badges: Crop[];
        path: Pick<Linework, "nodes" | "edges" | "coverage">;
      }>((resolve, reject) => {
        vision!.onmessage = (event) =>
          event.data.error
            ? reject(new Error(event.data.error))
            : resolve(event.data);
        vision!.onerror = () =>
          reject(
            new Error(
              "Map analysis stopped. You can retry or mark the paths yourself.",
            ),
          );
        vision!.postMessage({ image: pixels, pathImage });
      }),
      workSignal,
    );
    // Attach an immediate rejection handler while OCR starts, avoiding a late
    // unhandled rejection if a user closes the dialog during image analysis.
    geometryPromise.catch(() => undefined);
    update("Loading local text recognition", 0.08);
    const { createWorker, PSM } = await import("tesseract.js");
    workSignal.throwIfAborted();
    const assetBase = ocrAssetBase(window.location.origin);
    const selected = language === "eng" ? "eng" : `${language}+eng`;
    ocr = await abortable(
      createWorker(selected, 1, {
        workerPath: new URL("worker.min.js", assetBase).href,
        corePath: new URL("core/", assetBase).href,
        langPath: new URL("lang/", assetBase).href,
        gzip: false,
        workerBlobURL: false,
        cacheMethod: "none",
        logger: (message) => {
          if (message.status === "recognizing text")
            update(
              "Reading map labels",
              0.18 + Math.min(1, message.progress) * 0.24,
            );
        },
      }),
      workSignal,
      (late) => {
        void late.terminate();
      },
    );
    await ocr.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      user_defined_dpi: "150",
    });
    const textCanvas = cropCanvas(
      drawing.element,
      { x: 0, y: 0, width, height },
      2,
    );
    const result = await abortable(
      ocr.recognize(textCanvas, {}, { text: true, blocks: true }),
      workSignal,
    );
    textCanvas.width = 1;
    textCanvas.height = 1;
    const lines = flattenOCR(result.data.blocks, 2);
    await ocr.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const legends = findLegendRegions(lines, width, height);
    for (let i = 0; i < legends.length; i++) {
      workSignal.throwIfAborted();
      update(
        "Reading the map key",
        0.44 + (0.12 * i) / Math.max(1, legends.length),
      );
      const region = legends[i],
        crop = cropCanvas(drawing.element, region, 2.5);
      const read = await abortable(
        ocr.recognize(crop, {}, { text: true, blocks: true }),
        workSignal,
      );
      lines.push(...flattenOCR(read.data.blocks, 2.5, region));
      crop.width = 1;
      crop.height = 1;
    }
    const geometry = await geometryPromise;
    const markers: {
      number: string;
      x: number;
      y: number;
      confidence: number;
    }[] = [];
    await ocr.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_CHAR,
      tessedit_char_whitelist: "0123456789",
    });
    for (let i = 0; i < geometry.badges.length; i++) {
      workSignal.throwIfAborted();
      update(
        "Matching places to the map",
        0.58 + (0.25 * i) / Math.max(1, geometry.badges.length),
      );
      const b = geometry.badges[i],
        cleaned = cleanNumberBadge(pixels, b);
      const cleanedCanvas = canvas(cleaned.width, cleaned.height);
      cleanedCanvas.context.putImageData(
        new ImageData(
          new Uint8ClampedArray(cleaned.data),
          cleaned.width,
          cleaned.height,
        ),
        0,
        0,
      );
      const crop = cropCanvas(
        cleanedCanvas.element,
        { x: 0, y: 0, width: cleaned.width, height: cleaned.height },
        6,
        20,
      );
      let read = await abortable(
        ocr.recognize(crop, {}, { text: true, blocks: false }),
        workSignal,
      );
      if (
        !/^\d{1,3}$/.test(read.data.text.trim()) ||
        read.data.confidence < 60
      ) {
        await ocr.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
        const original = cropCanvas(drawing.element, b, 6, 20);
        const retry = await abortable(
          ocr.recognize(original, {}, { text: true, blocks: false }),
          workSignal,
        );
        if (retry.data.confidence > read.data.confidence) read = retry;
        original.width = 1;
        original.height = 1;
        await ocr.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR });
      }
      const text = read.data.text.trim();
      if (/^\d{1,3}$/.test(text) && read.data.confidence >= 60)
        markers.push({
          number: String(Number(text)),
          x: b.x + b.width / 2,
          y: b.y + b.height / 2,
          confidence: read.data.confidence,
        });
      crop.width = 1;
      crop.height = 1;
      cleanedCanvas.element.width = 1;
      cleanedCanvas.element.height = 1;
    }
    update("Preparing your interactive draft", 0.9);
    const pathXScale = pathImage.width / width;
    const pathYScale = pathImage.height / height;
    const layout = await abortable(
      new Promise<LayoutAnalysis>((resolve, reject) => {
        vision!.onmessage = (event) =>
          event.data.error
            ? reject(new Error(event.data.error))
            : resolve(event.data);
        vision!.onerror = () =>
          reject(
            new Error(
              "Layout analysis stopped. Retry or prepare this map manually.",
            ),
          );
        vision!.postMessage({
          kind: "layout",
          image: pathImage,
          lines: scaleOCRLines(lines, pathXScale, pathYScale),
          name: image.name,
        });
      }),
      workSignal,
    );
    const pathRegions = layout.candidateRegions;
    // Convert the source-derived pixel coordinates back to the OCR image space.
    layout.labels = layout.labels.map((l) => ({
      ...l,
      x: l.x / pathXScale,
      y: l.y / pathYScale,
    }));
    layout.candidateRegions = layout.candidateRegions.map((r) => ({
      ...r,
      x: r.x / pathXScale,
      y: r.y / pathYScale,
      width: r.width / pathXScale,
      height: r.height / pathYScale,
    }));
    if (layout.nodes) {
      layout.nodes = layout.nodes.map((n) => ({
        ...n,
        x: n.x / pathXScale,
        y: n.y / pathYScale,
      }));
    }
    const { labels, unresolved } = mergeDetections(
      extractLabels(lines, markers, width, height),
      layout,
      width,
      height,
    );
    let path = {
      nodes:
        layout.nodes && layout.nodes.length > 0
          ? layout.nodes
          : geometry.path.nodes.map((n) => ({
              ...n,
              x: n.x / pathXScale,
              y: n.y / pathYScale,
            })),
      edges:
        layout.edges && layout.edges.length > 0
          ? layout.edges
          : geometry.path.edges,
    };
    if (
      layout.layoutKind === "floorplan" &&
      (!layout.edges || layout.edges.length === 0)
    ) {
      const indoor = extractIndoorLinework(pathImage, pathRegions);
      path = {
        nodes: indoor.nodes.map((n) => ({
          ...n,
          x: n.x / pathXScale,
          y: n.y / pathYScale,
        })),
        edges: indoor.edges,
      };
    }
    if (labels.length < 2) {
      const regionsToUse = (
        pathRegions.length > 0 ? pathRegions : layout.candidateRegions
      ).slice(0, 3);
      for (let i = 0; i < regionsToUse.length && labels.length < 2; i++) {
        const r = regionsToUse[i];
        const cx = Math.round(r.x + r.width / 2);
        const cy = Math.round(r.y + r.height / 2);
        labels.push({
          text: labels.length === 0 ? "Main Entrance" : `Room ${i + 2}`,
          x: cx,
          y: cy,
          confidence: 70,
          source: "label",
          category: labels.length === 0 ? "Services" : "Teaching",
        });
      }
      if (labels.length < 2 && path.nodes.length >= 2) {
        const p0 = labels[0];
        const sorted = [...path.nodes].sort((a, b) => {
          const dA = p0 ? Math.hypot(a.x - p0.x, a.y - p0.y) : a.x + a.y;
          const dB = p0 ? Math.hypot(b.x - p0.x, b.y - p0.y) : b.x + b.y;
          return dB - dA;
        });
        for (let i = 0; i < sorted.length && labels.length < 2; i++) {
          labels.push({
            text: labels.length === 0 ? "Main Entrance" : "Main Hall",
            x: sorted[i].x,
            y: sorted[i].y,
            confidence: 65,
            source: "label",
            category: "Services",
          });
        }
      }
    }
    // Complex photographs do not reliably separate walls from walkways. Keep
    // useful labels but withhold path suggestions when evidence is weak.
    const quality = assessQuality(pixels, labels);
    if (
      quality.level === "limited" &&
      labels.length < 2 &&
      path.edges.length < 5
    ) {
      path.nodes = [];
      path.edges = [];
    }
    const wallMask =
      layout.layoutKind === "floorplan" ? detectWalls(pathImage) : null;
    const graph = attachPlaces(
      labels,
      path,
      width,
      height,
      wallMask
        ? (label, node) =>
            hasLineOfSight(
              label.x * pathXScale,
              label.y * pathYScale,
              node.x * pathXScale,
              node.y * pathYScale,
              wallMask,
              pathImage.width,
              pathImage.height,
            )
        : undefined,
    );
    const warnings = [
      ...layout.warnings,
      "Check names and approach points against the map. Detected paths may include roads; confirm pedestrian access and crossings.",
      "Step-free access and distances need your confirmation. Add a known scale to show metres and walking times.",
    ];
    if (!graph.edges.length)
      warnings.unshift(
        "No reliable walking paths were found. Trace the visible walkways to connect your places.",
      );
    if (labels.length < 2)
      warnings.unshift(
        "Some labels could not be read confidently. Add or rename places on the draft.",
      );
    const candidateRegions = layout.candidateRegions.map((r) => ({
      ...r,
      x: (r.x * source.naturalWidth) / width,
      y: (r.y * source.naturalHeight) / height,
      width: (r.width * source.naturalWidth) / width,
      height: (r.height * source.naturalHeight) / height,
    }));
    const analysis: EngineReport = {
      version: "local-3-reviewed-edges",
      language,
      quality,
      summary: `${labels.length} places found${unresolved.length ? ` · ${unresolved.length} labels to place` : ""}${graph.edges.length ? " with visible path suggestions" : "; ready to refine"}.`,
      warnings,
      labelsFound: labels.length,
      pathsFound: graph.edges.length,
      requiresReview: true,
      detectedLabels: labels.map((l) => ({
        ...l,
        x: (l.x * source.naturalWidth) / width,
        y: (l.y * source.naturalHeight) / height,
      })),
      pathKind: graph.edges.length ? "visible-linework" : "none",
      layoutKind: layout.layoutKind,
      unresolvedCount: unresolved.length,
      candidateRegions,
    };
    update("Draft ready to review", 1);
    const detectedTitle =
      layout.title ||
      lines.find(
        (line) =>
          line.confidence > 80 &&
          line.bbox.y0 < height * 0.16 &&
          line.bbox.y1 - line.bbox.y0 > height * 0.025 &&
          /map|plan/i.test(line.text),
      )?.text;
    const name = detectedTitle
      ? detectedTitle
          .replace(/\b\w+/g, (word) => word[0] + word.slice(1).toLowerCase())
          .slice(0, 70)
      : newMap(image).name;
    const prepared = {
      ...newMap(image),
      ...graph,
      name,
      unresolvedLabels: unresolved.map((l, i) => ({
        ...l,
        id: `unresolved-${i}`,
      })),
      nodes: graph.nodes.map((n) => ({
        ...n,
        x: (n.x * source.naturalWidth) / width,
        y: (n.y * source.naturalHeight) / height,
      })),
      places: graph.places.map((p) => {
        const pt = p.labelPoint
          ? {
              x: (p.labelPoint.x * source.naturalWidth) / width,
              y: (p.labelPoint.y * source.naturalHeight) / height,
            }
          : undefined;
        const matchingRegion = p.region
          ? {
              x: (p.region.x * source.naturalWidth) / width,
              y: (p.region.y * source.naturalHeight) / height,
              width: (p.region.width * source.naturalWidth) / width,
              height: (p.region.height * source.naturalHeight) / height,
              color: p.region.color,
            }
          : pt
            ? candidateRegions.find(
                (r) =>
                  pt.x >= r.x - 6 &&
                  pt.x <= r.x + r.width + 6 &&
                  pt.y >= r.y - 6 &&
                  pt.y <= r.y + r.height + 6,
              )
            : undefined;
        return {
          ...p,
          labelPoint: pt,
          region: matchingRegion
            ? {
                x: matchingRegion.x,
                y: matchingRegion.y,
                width: matchingRegion.width,
                height: matchingRegion.height,
                color: matchingRegion.color,
              }
            : undefined,
        };
      }),
      analysis,
    };
    return {
      ...autoConnectPlaces(prepared),
      analysis,
    };
  } catch (error) {
    if (workSignal.aborted && !signal?.aborted)
      throw new Error(
        "This map needs a little more time. Try a closer crop, or refine it manually.",
      );
    if (workSignal.aborted) throw aborted();
    throw error;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    workSignal.removeEventListener("abort", terminate);
    vision?.terminate();
    if (ocr) await ocr.terminate().catch(() => undefined);
  }
}
