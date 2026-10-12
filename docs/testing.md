# Verification and device checklist

Automated checks:

```bash
npm ci
npm run check
npm test
npm run build
npm run test:ocr
npm run format:check
```

The unit suite checks routing, alternatives, step-free filtering, reverse polyline geometry, import validation, candidate confirmation, synthetic road detection, blank layouts, label placement, search and timestamp expiry. The OCR smoke test reads a synthetic English PNG using the installed local model. It is not a representative campus accuracy benchmark.

## Browser and phone checks still required

Run these on Android Chrome and iPhone Safari, recording device, OS, browser version and result. Also test desktop keyboard use, screen-reader dialog names and zoom to 200%.

| Journey                                               | Expected result                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Day/night toggle in map header and session            | Readable text and categories; scene switch works; reduced motion is instant |
| Small screen and landscape                            | Map, search, route controls and dialogs remain reachable                    |
| Drag, pinch, rotate, keyboard and compass             | Geometry stays aligned; compass resets; imported map makes no north claim   |
| Two route alternatives                                | Distances remain ranked; selected route and written steps agree             |
| Upload portrait/landscape and multiple images         | Source and generated overlays align; floors stay separate                   |
| Remove a false path, review, request directions       | Only the remaining confirmed graph is used                                  |
| No labels / no roads / disconnected graph             | Honest empty state; no fabricated route                                     |
| Cancel import; close scanner while camera grant waits | Work stops; no late stream remains active                                   |
| Camera denied or BarcodeDetector missing              | Clear fallback link entry                                                   |
| End session during import                             | No imported map returns after cleanup                                       |
| Resume after three hours                              | Expired data cleared before exploration resumes                             |
| Storage disabled/full                                 | Honest message; current tab remains usable                                  |
| Fresh clone and static HTTPS deployment               | OCR assets load from same host; no API key needed                           |

Real-campus acceptance also requires field checks of entrances, closures, direction permissions and step-free evidence. The earlier survey workbook has separate validation findings and is not bundled or certified by this app release.

## Small layouts with a colour legend

Reimport the image to use the new reading pass. Check that the original drawing stays visible and that suggested numbered pins align with the correct buildings. Repeated colours should leave labels waiting for placement. Place one, cancel another, change floors and reload the session to verify the queue stays correct. Move a pin and confirm its paths require review again. Trace a walkway around two bends, undo one bend, finish at another pin and verify the route follows the traced geometry. Repeat with keyboard entry and touch. This browser/device checklist has not yet been completed for 0.3.0.
