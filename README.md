# Uniway

A mobile-first interactive campus navigation prototype built with React, TypeScript, Vite, and an illustrated SVG map. Willowbrook University is fictional; all paths and distances are demo data.

## Run locally

```sh
npm install
npm run dev
```

Open the localhost address printed by Vite. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

```sh
npm test
npm run build
npm run preview
```

## Try the app

- Search for the library, select it, and choose **Get directions**. Choose West Gate as the start, then enable **Step-free route** to see the library ramp alternative.
- Pan, zoom, fit the campus or selected route, and use the compass to rotate the actual map. Calibrate printed north for uploaded maps in the editor. Optional device headings require a supported sensor, HTTPS/localhost, and browser permission; manual rotation works without a sensor.
- Compare up to three loop-free routes: green solid, amber dashed, and terracotta dotted. Distances and instructions follow the selected route. Fewer choices appear when the graph has fewer alternatives; overlapping portions are shared paths.
- Use the sun/moon button in the header to switch between day and night mode, including the campus map and dialogs. Your choice is remembered on this browser; first visits follow your device appearance. If storage is unavailable, the toggle still works for the current visit.
- The glass interface floats over the full-screen map, with `#058C42` accents, softly blurred panels, subtle edges, and rounded controls in both themes. Night mode adds warm street lamps to the fictional campus; uploaded images retain their original colors. Reduced-transparency preferences use opaque surfaces; reduced-motion preferences disable movement effects.
- Select **Scan QR**, then **Just looking around?** to start a three-hour visitor session. Alternatively scan/upload a QR containing `uniway://willowbrook/south-gate`, `uniway://willowbrook/west-gate`, or `uniway://willowbrook/north-gate`.
- Camera scanning requires HTTPS or localhost. QR decoding is loaded only when needed. Closing the scanner stops all camera tracks.
- **Upload a map** accepts JPEG, PNG, and WebP images up to 15 MB each. Choose the printed layout language and **Make this map interactive**. Local OCR reads names and numbered keys; image analysis proposes visible neutral linework. Review the detected names, approach points, and paths before opening directions. **Open map preview** is always available, including when no paths can be extracted. Manual preparation remains available.
- In the editor, enable step-free only for paths you have verified. Paths connect at shared numbered points; crossing lines alone do not form a junction. Use **Set scale** to mark two points and enter a known distance in metres. Without calibration, navigation shows the path without invented distance or time estimates.
- Images, drafts, and prepared maps stay in browser memory for this open tab and are never uploaded to a server. Reloading clears them. Editing a draft does not change the currently published map until it is reviewed again.
- On mobile, expand or collapse the bottom sheet using its handle. The visitor countdown is in the expanded panel footer.

## Architecture

- `src/campus.ts`: typed places, entrances, nodes, and undirected path edges with step-free metadata.
- `src/routing.ts` / `src/routeAlternatives.ts`: Dijkstra and Yen route alternatives, walking estimates, and selected-route instructions. Networks above 400 nodes are routed in a worker for uploaded maps.
- `src/engine/`: local Tesseract OCR, number/legend association, conservative neutral-linework extraction, thinning, paint-hole removal, graph simplification, and quality feedback. OCR and geometric extraction run in workers.
- `src/MapPreparation.tsx`: language selection, cancellable analysis, progress, manual recovery, and always-available preview.
- `src/MapCompass.tsx`: actual SVG rotation, printed-north calibration, optional absolute sensor headings, permission/error handling, and cleanup.
- `src/CampusMap.tsx`: SVG campus, keyboard-selectable buildings, pan/zoom, route display, and map controls.
- `src/appearance.css` / `src/StreetLamps.tsx`: shared day/night materials, responsive floating panels, and decorative demo street lamps. `src/mapView.ts` fits maps and routes into the space available around those panels.
- `src/session.ts` / `src/useVisitorSession.ts`: absolute expiry timestamps, storage validation, focus/background recovery, and browser storage fallback.
- `src/QRPanel.tsx`: camera/image decoding with lazy `jsqr`, entrance validation, and camera cleanup.
- `src/UploadPanel.tsx`: validated local image previews and removal. App owns image object URLs and releases them when removed or unmounted.
- `src/MapEditor.tsx` / `src/preparedMap.ts`: guided image preparation, editable places, path connections, accessibility flags, calibration, and graph validation.
- `src/ImageMapCanvas.tsx` / `src/PreparedMapExplorer.tsx`: uploaded image map rendering, pan/zoom, keyboard placement, search, categories, and graph-based directions. Original image colors are preserved in both themes.

## Prototype boundaries

There is no backend, authentication, live positioning, cloud vision, or API key. Local analysis uses pretrained OCR and image-processing rules; **no new Uniway model was trained**. Automatic conversion is a draft, not a guarantee for arbitrary maps: blurry photographs, multiple floors, hidden entrances, colored paths, and ambiguous linework may need manual preparation. The original image remains the base layer; this does not reconstruct a fully illustrated vector campus. Detected building labels and proposed road approach points are stored separately. Pedestrian access, entrances, scale, and step-free status require review. QR codes currently identify the fictional Willowbrook entrances only. An active QR session keeps its original expiry when rescanned; expired sessions require a fresh scan. Browser storage and expiry can be changed by the visitor and are **not security enforcement**.

For production, map preparation should extract labels and geometry once, require human verification of entrances and walkable paths, and publish a versioned navigation graph. Enforce visitor access and expiry on the server. Keep expensive inference out of the student navigation flow and evaluate any local model on representative maps and target devices.

## Local assets and privacy

`public/ocr/` contains the runtime, eight language assets, licenses, and a SHA-256 manifest. The running app requests these from its own origin only, when preparation starts; it sends no map to a model service. `node scripts/setup-local-ocr.mjs` rebuilds these assets from pinned Tesseract trained-data sources and installed package versions (internet is needed for setup, not map processing). CSP headers in Vite restrict connections and scripts; apply equivalent headers if hosting elsewhere. Images and analysis are not persisted; reload clears them.

## Evaluation

See [ENGINE_PLAN.md](ENGINE_PLAN.md) for the implementation decisions, evidence, limits, and next local-model training milestones. Tests cover routing, session expiry/recovery, QR, uploads, compass permissions/cleanup, extraction boundaries, cancellation, and review-gated previews. `npm test -- --maxWorkers=2` limits test-worker resource use.

This is a local-only build; no site has been published.
