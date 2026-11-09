# Reproducible checks

`npm test` discovers only `src/**/*.test.ts` and `.tsx`; `.local` snapshots cannot inflate counts. `npm run check` checks TypeScript, `npm run engine:check` verifies local OCR bytes without network access, and `npm run build` checks the production bundle. CI runs these on a clean dependency install.

For browser checks, start `npm run preview -- --port 5173` after building. The scripts use installed Microsoft Edge and write ignored reports to `test-results/`:

```sh
node scripts/appearance-review.mjs
node scripts/browser-smoke.mjs "path/to/Science-Faculty-Map-01-scaled-1-1536x1087.jpg"
node scripts/browser-faint.mjs "path/to/faint-floor-plan.png"
node scripts/browser-phase1.mjs http://127.0.0.1:5173
```

The two real-map fixtures belong to the user and are not included in the repository. CI uses synthetic pixels and OCR observations instead. A private fixture check is evidence for that image only, never a general accuracy benchmark. Browser reports include external request and page-error checks. Keep screenshots and source maps out of pull requests unless sharing is authorized.

`browser-phase1.mjs` creates its synthetic fixture in memory and needs no private input. It verifies actual local OCR, pedestrian and accessibility review, routing, mobile/night rendering and Connect navigation from an uploaded map. Results are in `test-results/phase1/`. Older private-map scripts assume particular detection outputs and review behavior; treat them as historical workflows to adapt, not the acceptance gate for the current engine. See [navigation contracts](navigation-contracts.md).

Regression priorities: no outputs selected by filenames; no room-center routes through walls; no fabricated names from blank pixels; ambiguous colors and duplicate keys preserved for correction; coordinate scaling; cancelling analysis; review invalidation after movement; Unicode search; QR expiry; and mobile panel accessibility.

If `engine:check` reports missing assets, run `npm run engine:setup`. It reuses verified files, checks downloads against pinned hashes, and does not start an AI service. For unreadable photographs, verify that a quiet quality note and manual editing remain available. Phone camera, orientation sensors and language accuracy need representative physical-device testing beyond simulated unit tests.
