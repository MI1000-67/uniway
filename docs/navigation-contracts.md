# Navigation trust and integration contracts

## Setup and scope

Use Node 22.12+ and `npm ci`. Run `npm run engine:setup` once to obtain pinned local OCR assets, then `npm run engine:check`. Start `npm run dev`, or build and use `npm run preview`. No API key or backend is needed. Processing stays on this origin; maps and drafts stay in memory.

The November 2026 correction removes automatic known-campus presets and adds explicit uploaded-edge review. It preserves generic OCR, color/directory matching, indoor regions, linework extraction, manual preparation, fictional-campus routing and approved design tokens. It does not train a model or establish accuracy on arbitrary maps.

## Uploaded graph contract

`PreparedMap.edges` contains `PreparedEdge` values from `src/mapEdges.ts`:

```ts
type PreparedEdge = PathEdge & {
  origin: "detected" | "manual";
  review: { pedestrian: boolean; accessibility: boolean };
};
```

- `detectedEdge` always clears `stepFree` and both review flags, even if an extractor claims accessibility. Origin survives manual review.
- Drawing a segment with `addConnection` is an explicit pedestrian-access assertion. The drawing-tool step-free checkbox separately confirms accessibility for new segments.
- `reviewConnection` confirms/revokes pedestrian access or confirms the step-free choice for an existing segment. Accessibility cannot be confirmed before pedestrian access. Revoking pedestrian access clears accessibility and `stepFree`.
- `moveMapNode` invalidates pedestrian/accessibility review on every incident segment and marks the draft unpublished. Other segments retain their existing review.
- `reviewMap` checks names, node coordinates/references, connectivity using reviewed edges, review flags and unsupported step-free claims. `publishMap` returns `null` when checks fail. The editor additionally requires the final map-review checkbox.
- `routeOnMap` returns `null`, and `routesOnMap` returns `[]`, for unpublished or invalid/unreviewed maps. Step-free queries require both the flag and accessibility review. The routing worker uses these same functions; a different execution thread cannot bypass the contract.
- Missing legacy review metadata is untrusted and cannot route. No automatic persistence/migration is needed because uploaded maps exist only in the open tab. Reloading or reprocessing an upload creates a fresh draft.

These flags record human assertions in a local prototype. They are not proof of legal access, a security boundary against the device owner, or a substitute for campus verification. A production published graph needs versioned review and server authority.

## Extraction and failure behavior

Observed labels, regions and graph suggestions remain separate. A room outline is not a door; a printed title is not campus identification. No title/filename selects fixed coordinates. Ambiguous numbered positions remain unresolved regardless of the number of labels. The imported graph keeps polyline bends instead of replacing them with direct lines between buildings.

Indoor extraction works in geometry-pixel coordinates. It uses a wall mask to constrain candidate links and rechecks simplified segments. Indoor label approaches must also pass a line-of-sight check against the same mask. Pixel classification can still fail on glare, occlusion or unfamiliar maps: every suggestion requires review. Low-quality results withhold path suggestions while retaining preview and manual recovery. Do not describe this as perfect or universally wall-safe recognition.

If no usable paths are found, the editor stays available: place entrances, trace known walkways, confirm accessibility only where known, and optionally calibrate scale/north. Unknown scale means no invented metres or walking times. Independent uploads remain independent maps.

## Connect location references

`LocationReference` is `{ mapId: string, mapVersion: number, placeId: string }`. Pickup prose is separate display text and is never searched to guess a destination.

`resolveDemoLocation` currently accepts only the exact `willowbrook` version `1` map and an existing campus place ID. Student Centre uses `student`. Sports Ground has no destination node, so its seeded opportunity has no navigable reference. New listing/opportunity pickers offer mapped buildings only. Do not add a fake sports node to satisfy the button.

A successful handoff selects the demo view even if an uploaded map was active, then resets route/step selection and requests directions. A missing/unknown/stale/imported reference clears the prior destination and route and explains that routing is unavailable. An expired visitor session remains expired. The handoff is to a building, not the room or patio in pickup instructions.

Imported-map references are reserved for a later integration. They will need an available, reviewed map revision and a valid place in that revision. Reusing a matching building name across maps is insufficient. The local resolver is not permission to publish or upload maps.

## Reproducible checks

```sh
npm run check
npx vitest run src/engine/core.test.ts src/engine/imported/index.test.ts src/engine/merge.test.ts src/preparedMap.test.ts src/preparedFlows.test.tsx src/locations.test.ts src/connect/connect.test.tsx --maxWorkers=2
npm test -- --maxWorkers=2
npm run build
npm run preview -- --port 5178 --strictPort
```

In another terminal: `node scripts/browser-phase1.mjs http://127.0.0.1:5178`. It uses installed Edge by default (`UNIWAY_BROWSER_CHANNEL` can select an installed Playwright channel), creates a synthetic PNG in memory, exercises real local OCR, path/accessibility review, uploaded routing and Connect handoffs, and writes ignored `test-results/phase1/` evidence. A failed assertion exits nonzero. It never needs a private campus image. Browser checks need usable local OCR assets and a supported browser.

Unit regressions cover title/filename false positives, different image aspect ratios, conflicting keys above/below ten labels, sealed rooms/open doorways, missing review metadata, separate accessibility confirmation and movement invalidation. Real-phone sensors, representative-map accuracy and production access control need separate validation.
