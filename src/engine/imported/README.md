# Source-derived layout analysis

This module ports the reusable palette, generic directory matching, and room-region algorithms from `anti unieway/uniway-date-publish/src/import/{vision,palette,floorplan}.mjs`, licensed MIT by UniWay contributors. The original license is retained here. It is a TypeScript adaptation, not an unmodified copy.

`analyzeLayout({ image, lines, name? })` accepts RGBA pixels and the main engine's `OCRLine[]`. Every position and region uses those input pixels. It returns observed `labels`, `unresolvedLabels`, `candidateRegions`, `layoutKind`, `warnings`, and optional linework `nodes`/`edges`. Edges use the `PreparedEdge` contract: origin `detected`, pedestrian/accessibility review false, and `stepFree: false`. The caller owns resizing back to the original upload. The adapter rejects invalid dimensions/buffer sizes and images larger than 2048 pixels per side. The main OCR pipeline limits its inputs; limits in this adapter are not a general untrusted-file parser.

Automatic Lower Level, Science Faculty, Jamestown and USJ presets were removed in the November 2026 correction. Neither OCR titles nor filenames establish layout identity. Unlabelled regions do not acquire invented room names. Campus labels do not receive straight connectors to nearby roads; the main pipeline proposes approach points on actual linework for review. Colors and room outlines are suggestions, never proof of an entrance, pedestrian access or step-free status. The module has no DOM, worker startup, network calls or storage. Main Uniway retains its self-hosted OCR lifecycle and separate reviewed routing graph.

Run the focused regression suite with `npx vitest run src/engine/imported/index.test.ts`. Fixtures are synthetic so private uploaded maps do not enter the source tree.
