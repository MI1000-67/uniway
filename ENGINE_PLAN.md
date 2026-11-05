# Uniway local engine: implementation and next steps

## Goal and scope

Turn uploaded campus layouts into editable, searchable local map drafts, preserve uncertainty, and provide reviewed graph navigation with up to three genuine alternatives. Keep photos and analysis on the user's device. Support the eight requested layout languages, restrained quality feedback, actual map rotation, and optional device headings.

This implementation uses pretrained Tesseract OCR plus image-processing rules. It does **not** train a new model or guarantee perfect conversion of arbitrary maps. A photograph cannot reveal missing entrances, current construction, locked doors, accessibility, or floor connections. These require verification.

## Implemented flow

1. Validate JPEG/PNG/WebP uploads, create memory-only object URLs, and show the original image.
2. Choose the language printed on the map: English, Tamil, Sinhala, Hindi, Arabic, Spanish, French, or German. This selects OCR assets; it does not translate the interface or invent translated names.
3. Load local OCR code and the selected language (plus English for mixed labels) from this app's origin. Bound the image to 1,600 pixels on its longest side for OCR preparation and 1,000 pixels for geometry. OCR uses an enlarged copy for small print.
4. Read page labels, re-read candidate legend columns, find numbered badges, remove their enclosing rings, and match confident numbers to key entries. Conflicting number assignments are withheld.
5. Detect connected neutral linework, remove small enclosed white paint artifacts, thin it, trace its topology, and simplify straight samples within a sub-pixel tolerance. Colored buildings and dark wall strokes are not assumed walkable. This currently suits a subset of clear campus diagrams; it is not a general indoor floor-plan solver.
6. Store the detected label position separately from a proposed nearby approach point. Do not fabricate a straight connector through a building or garden. Disconnected labels remain disconnected. All automatic edges begin with step-free access unconfirmed.
7. Open an interactive preview at any time. Review and correct labels, entrances, pedestrian access, crossings, and connections before publishing directions in the current tab. A known scale is optional; without it, there are no invented metres or walking times.
8. Route along the reviewed graph. Yen's loop-free alternatives use Dijkstra spur searches. Show up to three choices with solid green, dashed amber, and dotted terracotta lines. Instructions, distance, time, highlighted path, and fit controls use the selected route. Complex uploaded graphs run in a worker with cancellation and a time limit.

## Interaction and privacy decisions

- Analysis has progress and cancellation. Closing the upload flow terminates workers. An unsuccessful analysis leaves manual editing and image preview available.
- Low-quality feedback is a small inline note. For the supplied glare photo, no unreliable walking graph is presented.
- SVG rotation changes the actual map. Pointer placement and panning use the inverse rotation. Uploaded north starts unknown and can be calibrated from a printed arrow. Manual angle controls work without sensor permission.
- Sensor readings are requested only on a button gesture. Relative alpha is rejected as a north reference; permission denial, unavailable sensors, stale readings, tilted phones, backgrounding, and unmounting have explicit handling.
- All OCR worker, WebAssembly, and language assets are self-hosted in `public/ocr/`, with licenses and a SHA-256 provenance manifest. The setup script downloads pretrained assets during development; the running app does not upload maps or contact an AI service.
- Vite serves CSP, no-referrer, and nosniff headers. The default local server binds to loopback. There is no cloud fallback, API key, analytics collector, or server persistence.
- Uploads and graphs remain in browser memory and are lost on reload. QR expiry metadata remains in `sessionStorage`; browser expiry demonstrates UX and does not enforce production access control.

## Evaluation on the supplied examples

Evaluated in headless Microsoft Edge on Windows, using the actual browser implementation and the supplied files. These are two examples, not a representative accuracy benchmark.

| Input                                   | Observed result                                                                                                | Remaining limitations                                                                                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Science Faculty map, 1536 × 1087        | 17 of 23 numbered places matched to the legend; 142 graph nodes and 143 proposed segments after simplification | Six places were not matched. Some punctuation/roman numerals need correction. Gray roads are suggestions, not verified pedestrian routes; building entrances and step-free status are not inferred. |
| Glare floor-plan photograph, 960 × 1280 | Quiet quality note; no confident destinations or walking edges; image remains explorable                       | A closer, straight-on image or manual marking is needed. The two floor layouts are not automatically connected.                                                                                     |

The Science Faculty test exercises review, publishing, search, north calibration, and route selection. The tested journey has two connected alternatives. The Willowbrook demo supplies three. No external HTTP analysis requests or page errors were observed in these flows. These checks do not validate real-world campus access.

Automated tests cover route ranking/uniqueness/accessibility, calibrated and uncalibrated directions, QR sessions/reload/background expiry, invalid images, camera cleanup, compass math/permission/cleanup, ambiguous OCR assignment, graph simplification, cancellation, and review-gated previews. Browser checks cover desktop, mobile, both themes, route selection, compass rotation, language options, and the supplied uploads.

Validation: 63 tests pass across 10 files, and the TypeScript/Vite production build succeeds. Both supplied-image browser flows pass against the production preview with the strict content security policy enabled, without page/console errors or external HTTP requests. Small font subsets are emitted as local files so they also comply with that policy. Device heading logic is tested with simulated readings; physical phone sensors and all eight OCR languages still need testing on representative devices and maps.

Relevant commands (run the local server first for browser checks):

```sh
npm test -- --maxWorkers=2
npm run build
node scripts/browser-smoke.mjs "path/to/Science-Faculty-Map-01-scaled-1-1536x1087.jpg"
node scripts/browser-faint.mjs "path/to/faint-floor-plan.png"
```

The browser scripts use installed Microsoft Edge. `scripts/evaluate-local-engine.mjs <science-image> <faint-image>` records detailed local JSON reports and requires the Vite development server. Test images are supplied as local paths and are not added to the app's public assets.

## Next local-model milestones

1. **Build a consented, verified dataset.** Separate campus plans, indoor floor plans, photographed signs, and schematic maps. Annotate labels, building footprints, entrances, walkable regions, crossings, stairs, lifts, floor transitions, scale, and north. Keep a held-out set from different campuses; never silently collect user uploads.
2. **Measure each failure separately.** Track label text accuracy, number-to-building association, entrance distance error, false traversable edges, disconnected valid routes, and confidence calibration. Evaluate blur, glare, rotation, perspective, languages, and unseen drawing styles. False traversable edges are the critical failure metric.
3. **Add photo correction.** Offer a local four-corner crop/perspective workflow and contrast improvement while retaining the untouched original. Do not hallucinate hidden or unreadable detail.
4. **Train and evaluate compact segmentation models.** Use the verified corpus to distinguish walkways from walls, roads, lawns, and buildings. Export a quantized candidate to ONNX; compare CPU/WASM and WebGPU on target phones. Keep inference in preparation workers and dispose of models after preparation. Model size, latency, memory, battery use, and thermal behavior must be measured; none is universally best.
5. **Publish verified graph versions.** If expanding beyond this prototype, add explicit floor/entrance semantics, change review, a graph export/import format, and deliberate local storage with a clear deletion control. Production visitor access enforcement is a separate server concern and must not require sending source images to a model service.

## Research references

- [Tesseract.js local installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md): custom worker, core, and language paths support self-hosted OCR assets.
- [W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/): secure contexts, explicit permission, absolute orientation, and device-coordinate considerations inform the compass implementation.
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/): a possible runtime for a future evaluated compact model, not an automatic guarantee of map understanding or phone performance.
