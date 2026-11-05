/** Adapted from anti unieway/src/import/vision.mjs (MIT), © 2026 UniWay contributors. */
import type { Component } from "./types";

export function components(
  mask: Uint8Array | Uint16Array,
  width: number,
  height: number,
): Component[] {
  const seen = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  const result: Component[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    seen[start] = 1;
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;
    let border = false;
    const pixels: number[] = [];
    while (head < tail) {
      const p = queue[head++];
      const x = p % width;
      const y = Math.floor(p / width);
      pixels.push(p);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      border ||= x === 0 || y === 0 || x === width - 1 || y === height - 1;
      for (const n of [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ]) {
        if (n >= 0 && !seen[n] && mask[n] === mask[start]) {
          seen[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    result.push({
      pixels,
      x: x0,
      y: y0,
      width: x1 - x0 + 1,
      height: y1 - y0 + 1,
      border,
      value: mask[start],
    });
  }
  return result;
}
