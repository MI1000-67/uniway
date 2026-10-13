# How UniWay works

UniWay is a static browser application. There is no account service or upload endpoint in this release.

| Area                               | Responsibility                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `src/main.tsx`                     | App state, search, session lifecycle, import/review flows and route walkthrough |
| `src/components/`                  | Map gestures, route options, timer, dialogs, theme switch and scanner           |
| `src/import/importMap.ts`          | Bounded image loading, local OCR and cancellable analysis                       |
| `src/import/vision.worker.ts`      | Runs layout processing away from the main UI thread                             |
| `src/import/vision.mjs`            | Connected components, road skeletons, proposed graph and label placement        |
| `src/engine.mjs`                   | Dijkstra routing, Yen alternatives, geometry, validation and expiry helpers     |
| `src/search.mjs`                   | Accent normalization, aliases and small spelling-error matching                 |
| `src/storage.ts`                   | IndexedDB session persistence                                                   |
| `src/data.ts`, `src/CampusArt.tsx` | Fictional demonstration graph and vector artwork                                |

## Import and review

1. Accept up to eight raster images, at most 15 MB each and 40 megapixels per decoded image.
2. Keep a source image up to 1,600 pixels on its longest side. Use a separate OCR canvas enlarged up to 3× and capped at 2,400 pixels. Load the compact quantized English LSTM model from the same host, on demand.
3. Read labels with bounding boxes, then analyze a raster with a longest side near 640 pixels in a worker.
4. Match distinct colour legend entries to buildings, retain ambiguous labels for manual placement, exclude thin outlines and legend sidebar marks; skeletonize candidate roads and connect nearby labels with candidate entrance segments.
5. Show numbered pins over the original source by default. Allow users to move pins and trace walkway bends. Every detected edge starts unconfirmed and not step-free.
6. Enable directions after explicit review. Moving a pin invalidates attached path and accessibility confirmations. Step-free status is checked separately. A manual correction is still needed when a label centre is not the actual entrance.

This is heuristic computer vision and OCR, not a general-purpose model that understands arbitrary maps. It can miss paths or confuse walls, legends and roads. No clear path network means no invented route through blank space.

## Routing

All edges are bidirectional in this prototype. Dijkstra finds the shortest mapped distance; Yen's algorithm supplies up to three distinct loop-free alternatives. Polyline geometry determines length when present. Imported maps compare distances in layout units; only the fictional demo has an illustrative metre scale. No GPS tracking occurs. Direction steps advance manually.

## Session and theme

An absolute timestamp determines the three-hour expiry. The app checks it each second and on focus/visibility changes. Expiry aborts active import and clears in-memory session content and IndexedDB. Theme preference lives under `uniway-theme` in localStorage and is applied before first paint through one root attribute.

## Hosting

Run `npm run build` and serve `dist/` at the origin root. Asset URLs currently assume root hosting. The optional `.openai/hosting.json` binds the original Sites project, so a fork should remove that identity before registering a new Site. Never reuse the original project ID to publish a fork.
