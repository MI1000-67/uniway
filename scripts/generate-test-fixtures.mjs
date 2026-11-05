import { mkdir, writeFile } from "node:fs/promises";
import QRCode from "qrcode";
import jsQR from "jsqr";

await mkdir("test-results", { recursive: true });
const payload = "uniway://willowbrook/west-gate";
const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
const quiet = 4,
  scale = 8,
  size = (qr.modules.size + quiet * 2) * scale;
const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
for (let y = 0; y < qr.modules.size; y++) {
  for (let x = 0; x < qr.modules.size; x++) {
    if (!qr.modules.get(y, x)) continue;
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const index =
          (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
        pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
      }
    }
  }
}
const result = jsQR(pixels, size, size);
if (result?.data !== payload) throw new Error("QR round-trip decoding failed");
await QRCode.toFile("test-results/west-gate-qr.png", payload, {
  width: 360,
  margin: 4,
});
await writeFile("test-results/not-an-image.txt", "Invalid upload fixture");
console.log(
  "QR encode/decode round trip passed. Fixtures written to test-results/.",
);
