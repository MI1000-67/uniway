# Source-derived layout analysis

This module ports the reusable palette, generic directory matching, and room-region algorithms from `anti unieway/uniway-date-publish/src/import/{vision,palette,floorplan}.mjs`, licensed MIT by UniWay contributors. The original license is retained here. It is a TypeScript adaptation, not an unmodified copy.

`analyzeLayout({ image, lines })` accepts RGBA pixels and the main engine's `OCRLine[]`. Every position and region uses those input pixels. It returns observed `labels`, `unresolvedLabels`, `candidateRegions`, `layoutKind`, `warnings`, and an empty `edges` array. The caller owns resizing back to the original upload. Inputs are bounded to 2048 pixels per side and 2000 OCR lines; outputs are bounded to 300 labels/regions.

Filename/campus presets, invented building names, nearest-room guesses, center-to-center paths, and inferred accessibility were removed. Colors and room outlines are suggestions for review, never proof of an entrance or pedestrian access. The module has no DOM, worker startup, network calls, storage, or UI dependencies. Main Uniway retains its self-hosted OCR lifecycle and separate reviewed routing graph.

Run the focused regression suite with `npx vitest run src/engine/imported/index.test.ts`. Fixtures are synthetic so private uploaded maps do not enter the source tree.
