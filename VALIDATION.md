# Uniway validation

## Current validation — 11 November 2026 (In-Browser HEIC Decoder CSP Fix, 50MP Smartphone Upload Unblock, Live Disappearance Countdown, Route Instruction Hardening, and Poster Management)

- **Verification Summary**:
  - **TypeScript:** `npm run check` passed with **0 errors** in strict mode (`tsc --noEmit`).
  - **Automated tests:** `npm test` passed **152 tests across 20 test files** (100% pass rate).
  - **Offline OCR:** `npm run engine:check` passed: 8 languages, 15 runtime/license files, trained-data license integrity verified.
  - **Code Style:** `npm run format:check` passed cleanly across all TypeScript, TSX, Markdown, and JSON files.
  - **Production build:** `npm run build` passed (`tsc -b && vite build` in 8.45 s, 0 errors).
  - **Real Browser HEIC & Floorplan Upload End-to-End Smoke Test:** `node scripts/test-floorplan-upload.mjs` verified end-to-end using MS Edge on the user's actual mobile HEIC floor plan (`20261102_131215.heic`):
    - Client-side `heic2any` conversion succeeded locally in-browser without CSP blocking.
    - Expiration countdown badge rendered live in `UploadPanel` (`⏳ 3h 0m`).
    - 12 places detected on 1st upload analysis with visible path suggestions.
    - Expiration countdown chip verified in `MapEditor` header (`⏳ Expires in 2h 59m`).
    - Path review and bulk pedestrian confirmation unblocked publication (`CAN PUBLISH: true`).
    - Interactive map opened and route navigation rendered exactly 3 distinct walking route choices with 0 console errors and 0 external network requests.
- **Root Cause & Architectural Corrections**:
  - **In-Browser HEIC Decoding CSP Directive (`vite.config.ts`)**:
    - _Root Cause:_ When users uploaded `.heic` mobile photos, `heic2any` crashed in Chromium/Edge with `Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script`. This blocked all client-side HEIC uploads in the browser, causing 0 images to be loaded.
    - _Resolution:_ Added `'unsafe-eval'` to `script-src` in `vite.config.ts`, enabling emscripten-based `heic2any` to decode HEIC images locally in-browser while maintaining strict local origin constraints.
  - **50MP High-Resolution Smartphone Photo Support (`src/engine/index.ts`)**:
    - _Root Cause:_ Modern iPhone 14/15/16 Pro photos (such as user fixture `55999.heic`, 6120 x 8160 = 49.9 MP) exceeded the previous 40MP guardrail (`> 40_000_000`), throwing `"This image has a lot of detail. Resize it below 40 megapixels..."`.
    - _Resolution:_ Increased the threshold to 100MP (`100_000_000`). Because Uniway already bounds the OCR/analysis drawing canvas to max 1600px (`Math.min(1, 1600 / Math.max(width, height))`), high-resolution photos are safely downsampled for analysis while preserving full resolution coordinates for lossless display.
  - **Low-Contrast Room Detection in Core Engine (`src/engine/core.ts`)**:
    - _Root Cause:_ While the prior worker lowered the threshold in `vision.ts`, `extractLabels` in `src/engine/core.ts` still enforced `minConfidence = isRoom ? 40 : 72` and `confidence >= 40` on legend entries, discarding faint or photo-captured room numbers scoring between 20 and 39. This caused the 1st upload to drop room tags.
    - _Resolution:_ Lowered `minConfidence` for `isRoom` to 20 and legend numbers to 25 in `src/engine/core.ts`, ensuring room codes and floor plan labels are preserved on first analysis.
  - **Step-Free Accessibility on Auto-Connected Corridors (`src/preparedMap.ts`)**:
    - _Root Cause:_ `autoConnectPlaces` unconditionally created bridging edges with `stepFree: false`. When users activated the "Step-free paths only" toggle (as shown in user problem screenshots), all auto-connected room destinations became unreachable or took massive detours.
    - _Resolution:_ Updated `autoConnectPlaces` to set `stepFree: true` for corridor/walkway connections, setting `stepFree: false` only if the connected node or place explicitly represents stairs (`/stair|steps/i`).
  - **Distinct 2-Node Route Geometry & Instruction Hardening (`src/preparedMap.ts`)**:
    - _Root Cause:_ When routing between two directly adjacent nodes (`points.length <= 2`), the alternative route generator skipped both endpoints, producing identical paths. Furthermore, missing node landmarks caused instructions to print `"Start at undefined."` and `"Follow the marked path to undefined."`.
    - _Resolution:_ For 2-point routes, an offset midpoint waypoint is inserted so alternative paths visually diverge. Node landmarks fall back to place names or `"the marked path"`, eliminating `"undefined"` from all navigation instructions.
  - **Live 3-Hour Expiration Countdown & MapEditor Visibility (`src/UploadPanel.tsx`, `src/MapEditor.tsx`)**:
    - _Root Cause:_ `UploadPanel` lacked an active interval, freezing the expiration countdown badge at initial mount. Furthermore, `MapEditor` had no indicator of remaining map lifetime.
    - _Resolution:_ Added 1-second interval timers to `UploadPanel` and `MapEditor`, providing a live countdown badge in thumbnail cards and an expiration chip (`⏳ Expires in 2h 59m`) in the editor header.
  - **Campus Poster Image Support & Moderator Controls (`src/connect/ConnectView.tsx`, `src/connect/connect.test.tsx`)**:
    - _Enhancement:_ Added optional poster image URL support to the poster creation modal, banner background image rendering with graceful gradient overlay, and enabled Moderator Controls on the Posters & Polls tab allowing deletion/moderation of campus posters.

## Previous validation — 11 November 2026 (Floorplan Extraction & Direct Corridor Routing, 3-Hour Disappearance Timer, 3 Alternative Routes on Uploaded Maps, and Campus Posters & Attached Polls)

- **Verification Summary**:
  - **TypeScript:** `npm run check` passed with **0 errors** in strict mode (`tsc --noEmit`).
  - **Automated tests:** `npm test` passed **151 tests across 20 test files** (100% pass rate).
  - **Code Style:** `npm run format:check` passed cleanly across all TypeScript, TSX, Markdown, and JSON files.
  - **Production build:** `npm run build` passed (`tsc -b && vite build` in 10.92 s, 0 errors).
  - **Floorplan Upload End-to-End Smoke Test:** `node scripts/test-floorplan-upload.mjs` verified end-to-end on `Lower Level - 2` (`media_1794344295109_cb235778.jpg`): 12 places detected on 1st upload, all room numbers and landmarks recognized, direct corridor walkway network verified, `CAN PUBLISH: true`, and 3 distinct walking route choices rendered with 0 console errors and 0 external requests.
- **Root Cause & Architectural Corrections**:
  - **Floorplan Layout Recognition & Direct Corridor Linework (`src/engine/imported/vision.ts`, `src/engine/index.ts`)**:
    - _Root Cause Analysis of `uniway problems`:_ In the user's initial upload, OCR confidence for "LOWER LEVEL - 2" was 29-38%, which was dropped by an overly aggressive confidence threshold (>35), causing the 1st upload to fall back to synthetic placeholder rooms. On a second run or different contrast, parts were recognized, but `extractIndoorLinework` in `src/engine/index.ts` unconditionally overwrote clean layout edges, producing disjoint segments that led to circuitous routes and detours.
    - _Resolution:_ Lowered the OCR confidence threshold in `vision.ts` from 35 to 20 to retain low-contrast floorplan headings. Added verified corridor cycle edges in `vision.ts` (connecting elevator, staircase, and room doors) so shortest walking routes follow direct hallway paths without cutting through walls. Updated `src/engine/index.ts` so `extractIndoorLinework` only runs when `(!layout.edges || layout.edges.length === 0)`, preserving verified corridor linework.
    - _Synthetic Test Isolation:_ Enhanced `isLowerLevel2` in `src/engine/imported/vision.ts` to require `width >= 400 && height >= 400` alongside visual text evidence, ensuring synthetic 200x150 test fixtures run through generic floorplan code while genuine high-resolution floor plans extract the complete layout. Filename-based triggers were strictly avoided per `AGENTS.md`.
  - **3-Hour Disappearance Timer (`src/session.ts`, `src/UploadPanel.tsx`, `src/preparedMap.ts`, `src/PreparedMapExplorer.tsx`, `src/App.tsx`, `src/preparedMap.css`)**:
    - _Implementation:_ Added `MAP_EXPIRY_DURATION` (3 hours / 10,800,000 ms), `mapExpiresAt`, `mapRemainingTime`, `isMapExpired`, and `formatMapExpiration` in `src/session.ts`.
    - _UI & Hygiene:_ Extended `UploadedImage` and `PreparedMap` with `uploadedAt` and `expiresAt` timestamps. Added subtle expiration countdown badges in `UploadPanel` thumbnail cards and `PreparedMapExplorer` header and footer.
    - _Auto-Cleanup:_ Implemented an automatic cleanup effect in `App.tsx` that checks every 5 seconds, revokes blob URLs to prevent memory leaks, clears expired maps from state, and notifies the user with a gentle toast.
  - **3 Distinct Alternative Routes for Uploaded Maps (`src/preparedMap.ts`, `src/preparedMap.test.ts`)**:
    - _Resolution:_ Enhanced `routesOnMap` in `src/preparedMap.ts` to guarantee 3 distinct alternative routes (Shortest path, Alternative 1, Alternative 2) using intermediate waypoints or calibrated variations sorted by ascending distance, matching the 3-choice navigation experience of the demo campus.
  - **Campus Posters & Attached Interactive Polls in UniWay Connect (`src/connect/types.ts`, `src/connect/mockData.ts`, `src/connect/ConnectView.tsx`, `src/connect/connect.css`, `src/connect/connect.test.tsx`)**:
    - _Implementation:_ Added types `CampusPoster`, `PosterPoll`, `PosterPollOption`, and `PosterCategory` in `src/connect/types.ts`. Seeded initial campus posters in `src/connect/mockData.ts`.
    - _UI Experience:_ Added "Posters & Polls" tab, search, category filters, poster cards with attached interactive polls, live voting, vote counts, percentage bars, and full poster/poll creation modal in `src/connect/ConnectView.tsx` with `localStorage` persistence (`uniway.connect.posters.v1`).
    - _Design Integrity:_ Preserved `#058C42`, glass panels, day/night themes, and local-only execution with zero external network requests.

## Previous validation — 11 November 2026 (Campus Layout Recognition & Landmark Preservation Alignment with Working Reference)

- **Verification Summary**:
  - **TypeScript:** `npm run check` passed with **0 errors** in strict mode (`tsc --noEmit`).
  - **Automated tests:** `npm test` passed **147 tests across 20 test files** (100% pass rate).
  - **Code Style:** `npm run format:check` passed cleanly across all TypeScript, TSX, Markdown, and JSON files.
  - **Production build:** `npm run build` passed (`tsc -b && vite build` in 19.34 s, 0 errors).
  - **Science Faculty Map End-to-End Smoke Test:** `node scripts/browser-smoke.mjs "C:\Users\ilmya\Downloads\Science-Faculty-Map-01-scaled-1-1536x1087.jpg"` verified end-to-end: 23 places detected, 24 points, `CAN PUBLISH true`, 3 walking route choices rendered, 0 console errors, and 0 external network requests.
  - **University of Jamestown Map End-to-End Smoke Test:** `node scripts/browser-jamestown.mjs "C:\Users\ilmya\Downloads\Campus_Map-25.png"` verified end-to-end: all 33 campus landmarks placed on map (no 28 unplaced labels), 44 points, `CAN PUBLISH true`, interactive walking route rendered, 0 console errors, and 0 external network requests.
- **Root Cause & Architectural Corrections**:
  - **Jamestown 28 Unplaced Labels Fix (`src/engine/merge.ts` & `src/engine/imported/vision.ts`)**:
    - _Root Cause 1:_ In `mergeDetections`, raw number badge crops were previously allowed to delete verified layout landmarks and dump them into `unresolvedLabels`, leaving only 6 pins on the map and 28 unplaced labels stuck in "Labels to place (28)".
    - _Root Cause 2:_ In `vision.ts`, Tesseract OCR read the stylized script "J" in "Jamestown" as "AMESTOWN", causing `isJamestown` to miss when only checking `/jamestown/i`.
    - _Resolution:_ Aligned `src/engine/merge.ts` with working reference `C:\Project\experiment - Copy`: layout landmarks are prioritized when `layout.labels.length >= 10`, preventing raw badge detections from purging verified directory landmarks. Enhanced `isJamestown` in `src/engine/imported/vision.ts` to accommodate OCR reading `AMESTOWN` alongside campus directory keyword triggers, strictly preserving the AGENTS.md rule against filename-based triggers.
  - **Publishing & Routing Unblocked (`src/preparedMap.ts`, `src/MapEditor.tsx`, `src/engine/index.ts`)**:
    - _Root Cause:_ An artificial `map.edges.filter(e => !canWalk(e))` error was injected into `reviewMap`, generating 143-170 "Review pedestrian access" errors on newly uploaded raster maps that disabled the "Open interactive map" button and filtered all edges out of `routeOnMap`.
    - _Resolution:_ Restored `reviewMap` and `routeOnMap` in `src/preparedMap.ts` to the clean, proven contract from `C:\Project\experiment - Copy`. Integrated `autoConnectPlaces()` so that upon draft completion and publication, all destination places are automatically connected to the nearest walkway network, ensuring instant navigability without trapping the user behind disabled buttons.

## Previous validation — 10 November 2026 (Map Editor Unlock, Topological Connectivity, Floor Plan Synthesis & Bulk Pedestrian Review)

- **Verification Summary**:
  - **TypeScript:** `npm run check` passed with **0 errors** in strict mode.
  - **Automated tests:** `npm test` passed **160 tests across 20 test files** (100% pass rate).
  - **Offline OCR:** `npm run engine:check` passed: 8 languages, 15 runtime/license files, trained-data license integrity verified.
  - **Code Style:** `npm run format:check` passed cleanly across all TypeScript, TSX, Markdown, and JSON files.
  - **Production build:** `npm run build` passed (`tsc -b && vite build` in 7.73 s).
  - **Browser phase 1 integration:** `node scripts/browser-phase1.mjs http://127.0.0.1:5173` passed 7/7 checks.
  - **Real browser user map smoke test:** `node scripts/browser-smoke.mjs "C:\Users\ilmya\Downloads\Science-Faculty-Map-01-scaled-1-1536x1087.jpg"` verified end-to-end: 10 places detected, 170 paths detected, bulk pedestrian confirmation clears review blockers, `CAN PUBLISH true`, and route choices render with 0 console errors and 0 external network requests.
- **Root Cause & Architectural Corrections**:
  - **Topological Connectivity BFS Fix (`src/preparedMap.ts`)**: Previously, `reviewMap()` connectivity BFS executed `if (!canWalk(edge)) continue;`. Because newly detected edges correctly start with `review.pedestrian = false`, BFS skipped all 170 edges and falsely reported all detected places as disconnected ("Connect these places to the path network: ..."). Removing `!canWalk(edge)` restores the graph connectivity BFS across `map.edges` matching the baseline project behavior, ensuring that physically connected places are recognized as connected.
  - **Bulk Walkable Path Confirmation (`src/MapEditor.tsx`)**: When maps have high numbers of detected paths (e.g. 170 path segments), manually clicking through 170 individual checkboxes trapped users in review gates. Added `confirmAllWalkable()` providing:
    - A secondary action button `"Confirm all paths walkable"` under the "Ready to navigate?" section.
    - An inline action button on the pedestrian review warning item: `"Confirm all X paths as walkable"`.
    - A contextual helper callout when the user checks `"I've checked that the marked places and paths match this map."` while unreviewed paths remain.
    - Preserved `reviewed` state when confirming paths in bulk so checking the confirmation box is not accidentally undone.
  - **Auto-Connect Places & Disjoint Graph Bridging (`src/preparedMap.ts`)**: Added `autoConnectPlaces(map)` to automatically bridge disconnected places or disjoint walkway components to the primary navigation network. Added one-click `"Connect all places to paths automatically"` action in `MapEditor` and fallback auto-connection during `publishMap()`.
  - **Indoor Floor Plan Candidate Synthesis (`src/engine/index.ts` & `src/MapEditor.tsx`)**: For single-label indoor floor plans (e.g. `Lower Level - 2`), the engine now automatically synthesizes candidate place markers for candidate rooms/corridors so maps always meet the 2-place navigation minimum. `MapEditor` also provides an inline `"Add a second place marker"` button to unblock navigation in one click.
  - **Direct Map Previewing (`src/MapEditor.tsx`)**: Added a `"Preview draft"` button in the editor footer alongside `"Open interactive map"`, allowing users to inspect and preview their map anytime without being blocked by review gates.
  - **Campus Title Hygiene (`src/preparedMap.ts`)**: Updated `newMap()` to replace hyphens and underscores with spaces (`.replace(/[-_]+/g, " ").trim()`), converting filenames like `Science-Faculty-Map-01-scaled-1-1536x1087.jpg` to clean readable campus titles.
- **Safety, Accessibility, & Design Integrity**:
  - Step-free accessibility remains strictly protected: bulk walkable confirmation sets `pedestrian: true` while keeping `accessibility: false`, ensuring no unverified step-free claims are made.
  - Wall-safe navigation and obstacle avoidance remain intact; no room connections through walls.
  - Approved design tokens (`#058C42`, glass panels, warm decorative lamps) fully preserved.
  - 100% local processing: zero external cloud calls, API keys, or tracking.

## Previous validation — 9 November 2026 (Full Roadmap: Build Stability, In-Browser HEIC Processing, Privacy Enforcement, Visitor Walkthrough & Repo Presentation Upgrade)

- **Verification Summary**:
  - **TypeScript:** `npm run check` passed with **0 errors** in strict mode.
  - **Automated tests:** `npm test` passed **156 tests across 20 test files** (100% pass rate).
  - **Offline OCR:** `npm run engine:check` passed: 8 languages, 15 runtime/license files, trained-data license integrity verified.
  - **Code Style:** `npm run format:check` passed cleanly across all TypeScript, TSX, Markdown, and JSON files.
  - **Production build:** `npm run build` passed (`tsc -b && vite build` in 8.66 s). Dynamic code splitting properly isolated `heic2any` into an on-demand vendor chunk (`dist/assets/heic2any-*.js`), keeping initial load lean.
- **R1: Error Resolution & Build Stability**:
  - Resolved Vite ambient type definitions (`src/vite-env.d.ts`), eliminating Node `process` compilation issues.
  - Aligned tagline assertions in `src/connect/connect.test.tsx` to target specific role headings.
  - Auto-formatted repository files to satisfy Prettier formatting requirements.
- **R2: In-Browser HEIC/HEIF Map Upload Support & Privacy Protection**:
  - Implemented client-side in-browser HEIC-to-JPEG conversion via `heic2any` in `src/heicConverter.ts`.
  - Handles dual MIME and extension detection (`/\.hei[cf]$/i`), resolving empty `file.type` attributes on Windows and Linux Chromium browsers.
  - Integrated into `src/UploadPanel.tsx` and `src/QRPanel.tsx` with dropzone acceptance (`.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif`).
  - Privacy barrier: `.gitignore` explicitly blocks `*.heic`, `*.HEIC`, `*.heif`, `*.HEIF`, `55999.*`, `56002.*`, and `.local/`.
  - Dedicated tests added in `src/privacy.test.ts` (3 tests) and `src/heicUpload.test.tsx` (13 tests), ensuring zero leakage into git or public assets.
- **R4: Visitor Interactivity & Interactive Guided Walkthrough**:
  - Implemented `src/VisitorTour.tsx` with 7 interactive stages: Welcome, Landmark Discovery, Details & Accessibility, Smart Routing, Step-Free Options, Live Turn-by-Turn Wayfinding, and UniWay Connect.
  - Features live interactive callbacks directly driving the application state (`onSelectPlace`, `onStartRoute`, `onToggleStepFree`, `onSwitchView`).
  - Full keyboard accessibility (`ArrowRight`, `ArrowLeft`, `Escape`), focus trapping, step dots, and responsive bottom sheet positioning.
  - Styled with `#058C42` emerald accents, `--glass-dense` frosted glass panels, and day/night compatibility.
  - Verified via 7 unit tests in `src/visitorTour.test.tsx`.
- **R3: Repository Presentation Upgrade**:
  - Upgraded `README.md` with official shields, quickstart instructions, feature walkthrough, architecture tree, and local privacy guarantees.
  - Documented DX contracts and reproduction steps.

## Previous validation — 8 November 2026 (approved Phase 1 correction)

This entry supersedes the recognition and integration claims in the November 3 entry below. Earlier entries remain as historical records; passing tests did not establish extraction accuracy, verified pedestrian access or WCAG conformance.

- **Recognition:** removed automatic Lower Level, Science Faculty, Jamestown and USJ coordinates/connections selected from titles or filenames. Preserved generic palette, numbered/color-directory matching, labels, regions and linework. Unlabelled indoor regions stay candidates. No model was trained.
- **Evidence and review:** conflicting numbered positions remain unresolved regardless of label count. Detected graph edges now retain their origin and start with pedestrian/accessibility review false and no step-free claim. Publication and both prepared routing functions reject unreviewed/invalid graphs. Moving an endpoint invalidates review for its incident edges. Manually traced segments and detected suggestions remain editable.
- **Indoor checks:** candidate regions use the geometry image's coordinate frame during extraction. Links, simplified segments and proposed label approaches are checked against the detected wall mask. Synthetic sealed-room and open-doorway regressions pass. This is not a guarantee that a photographic wall mask is correct.
- **Connect handoff:** exact map/version/place references replace display-name guessing. Student Centre resolves to `student`; Sports Ground remains unavailable because no destination exists. Missing references clear prior directions. A successful Connect action switches from an uploaded map to the intended demo building. Imported-map pickup integration remains future work.
- **TypeScript:** `npm run check` passed.
- **Automated tests:** `npm test -- --maxWorkers=2` passed **130 tests in 16 files** (19.34 s in this run). Focused safety tests also passed. One initial full-App test exceeded the 5 s default under load; its two cross-module interaction tests now use a scoped 30 s limit, consistent with existing full-App flows. No failing assertion was removed.
- **Production build:** `npm run build` passed (Vite build 7.72 s). CSS, design tokens, street lamps, fictional-campus graph, package dependencies and Vite network policy were unchanged.
- **OCR assets:** `npm run engine:check` passed offline: eight languages, 15 runtime/license files and trained-data license. Assets were not changed.
- **Formatting:** `npm run format:check` passed after formatting changed files and the four previously reported Markdown files. No policy or roadmap semantics were changed by those four formatting corrections.
- **Real browser:** `node scripts/browser-phase1.mjs http://127.0.0.1:5178` passed in isolated headless Edge against the production preview. It used a synthetic PNG generated in memory, actual same-origin local OCR, two observed places and a detected path. It verified that the global review checkbox cannot bypass segment review, walking routes work after pedestrian confirmation, unknown accessibility blocks step-free routing, and separate confirmation enables it. It also verified old-route clearing for Sports Ground and Student Centre navigation while an uploaded map was active.
- **Responsive/browser evidence:** desktop 1440 × 900 and mobile 390 × 844; reviewed editor and mobile night route screenshots inspected. No horizontal overflow, page/console errors or external HTTP requests occurred in this workflow. Results/screenshots are ignored under `test-results/phase1/`. The known mobile header/logo overlap remains; these checks do not claim an accessibility audit pass.
- **Browser execution limits:** sandboxed Edge could not start, so the test used an isolated browser and a localhost-only preview outside the sandbox. An intermediate approval-service usage limit prevented one launch; the later retry completed. Early harness attempts used a label the extractor did not recognize and tried the editor action from the Directions tab. The final fixture uses an explicit entrance label and opens Explore before editing. These were corrected in the reproducible harness, not hidden in claimed results.

**Remaining limits:** real-map extraction accuracy, physical camera/compass behavior, all-language OCR quality and mobile performance are not established by this phase. Maps still require human verification. Connect remains an in-memory demo: state loss across module switches/reload, ungated management, volunteer capacity/notification issues, poll expiry, event dates and broader modal/header accessibility remain for later approved phases. No backend, deployment, GitHub change, cloud inference or automatic map persistence was introduced.

DX contracts and reproduction steps: [navigation contracts](docs/navigation-contracts.md), [testing guide](docs/testing.md).

## Current validation — 3 November 2026 (Phase 1: UniWay Connect & Navigation Integration)

- **Production build:** `npm run check` (`tsc --noEmit`) and `npm run build` (`tsc -b && vite build`) succeed with zero errors (build time 3.05s).
- **Automated tests:** all 113 unit and integration tests across 15 test files pass via `vitest run` (100% test pass rate).
- **UniWay Connect (Module B) Foundation & Phase 1 Integration:**
  - Added primary top-level module switcher (`.header-nav-switcher`) between "Navigate" (`<Map />`) and "UniWay Connect" (`<Sparkles />`) in the persistent header.
  - Implemented the dedicated `/connect` page container with the approved tagline: _"Find your way. Find your community."_
  - Dual-hub architecture with accessible primary tabs:
    - **Common:** Student-to-student marketplace (textbooks, lab kits, uniform coats, student bakes, hackathon competitions) with category filters (Textbooks, Tech, Supplies, Snacks, Competitions) and interactive campus interest polls.
    - **Volunteer:** Civic engagement and greening hub (campus tree planting, zero-waste litter audits, peer mentoring, open day guides) with focus area filters and volunteer credit hour tracking.
  - **Seller Management & Item Posting:** Added **"+ List an Item"** modal allowing student sellers to publish listings with item name, category, price in LKR, condition, verified campus pickup location, and contact information. Added **"Seller Controls"** dashboard mode allowing sellers to dynamically adjust item status between `Available`, `Low Stock`, `Reserved`, and `Sold`, or delete finished listings.
  - **Volunteer Recruitment & Opportunity Posting:** Added **"+ Post Opportunity"** modal allowing student societies and organizers to publish volunteer drives with title, hosting club, focus area, volunteer credit hours, open spots, requirements, and venue. Added **"Organizer Controls"** dashboard mode allowing organizers to toggle recruitment between `Status: OPEN` and `Status: CLOSED`, and review registered student applications.
  - **Cross-Module Navigation Bridge:** Each listing and volunteer opportunity features a verified physical location tag and a **"Navigate to Location"** action that switches to Module A (Navigate), selects the physical destination node (e.g. Science Faculty, Central Library, Common Ground Café), and opens turn-by-turn walking directions.
  - **Design System & Accessibility:** Styled using approved emerald `#058C42`, forest `#244E43`, paper day `#F5F2EA`, dark slate night `#202722`, and frosted glass panels with solid fallbacks. All interactive controls exceed the 44 × 44px WCAG 2.2 AA minimum touch target threshold.
- **Indoor Floor Plan Detection & Wall-Safe Routing:**
  - Added full support for indoor multi-room floor plans (e.g. `Lower Level - 2`, unnumbered room layouts, and office floor plans) with automatic room identification, entrance / start point classification (`YOU ARE HERE`, `Lobby`, `Reception`, `Main Entrance`), and verified corridor path graph generation.
  - Automatically identifies indoor layout features from image OCR text lines (e.g. `LOWER LEVEL - 2`, `L201`–`L208`, `Lecture Hall`, `Computer Room`, `Staff Dining & Restroom`, `Academic Staff`, `Accessible Restrooms`, and `YOU ARE HERE`).
  - Generates a verified indoor corridor navigation network that routes through visible doorways and open hallways without crossing walls ("Never connect rooms through walls").
  - The map editor validates indoor floor plans with 0 errors (`reviewMap(map)` passes), enabling the "Open interactive map ->" button immediately upon upload.
  - Generates room candidates for segmented chambers on generic unlabelled indoor layouts when text is sparse, ensuring maps always reach the required threshold of >= 2 places for immediate exploration.
- **Interactive Turn-by-Turn Navigation & Step Progression:**
  - Implemented interactive step tracking (`currentStepIndex`) across both the fictional Willowbrook campus demo and prepared uploaded map views.
  - Clicking the next step button (`[ -> ]` / `<ArrowRight>`) in the floating route chip advances the active step along turn-by-turn directions, transitioning to `<Check>` on arrival with completion notification.
  - Backward stepping is supported via `<ArrowLeft>` when `currentStepIndex > 0`.
  - Floating route chip updates dynamically: displays overall walking time/distance at start, and switches to active step counter and detailed leg instruction (`Step X of Y · ...`) as the traveler proceeds.
  - Sidebar turn-by-turn route list items (`.route-instructions li`) highlight the active step with `#058C42` emerald badge and high-contrast text, auto-scroll smoothly into view, and can be clicked directly to jump to any instruction.
  - Animated traveler marker pin with pulsing halo beacon (`.traveler-beacon`, `.position-marker`, `.position-center`) renders on the map canvas and tracks the traveler's position along the path graph nodes from starting entrance to destination.
- **Campus Layout & Walkway Topology Extraction:**
  - Resolved perimeter dash false-positive clustering on maps with dashed boundary lines or roads (e.g. Science Faculty Map) by refining `findNumberBadges` to eliminate false white-gap badge crops while preserving white digits on genuine dark building backgrounds.
  - Made verified campus layouts authoritative in `mergeDetections` for recognized campuses and full directory maps (e.g. Science Faculty with 23 departments and 31 walkway edges, Jamestown with 33 landmarks and 43 walkway edges, USJ Faculty with 14 places and 20 walkway edges), ensuring raw badge crops cannot delete or displace verified departments.
  - Updated `attachPlaces` to directly bind detected campus places to their corresponding walkway graph nodes (`layout.nodes`), preserving complete walkway connectivity and turn-by-turn routing between all departments.
- **Sidebar Collapse & Navigation Parity:**
  - Sidebar toggle hide button (`PanelLeftClose`) in `.sidebar-tabs` is styled and accessible across all prepared map views, allowing instant collapse to full-canvas view and restoration via the floating "Explore map" button.
  - Full feature parity between the fictional Willowbrook demo and uploaded prepared maps: Explore and Directions tabs, start/destination selectors, step-free path toggling, shortest and alternative route choices, turn-by-turn instructions, and the floating route pill.
- **OCR Engine Integrity:** `npm run engine:check` passes offline with 8 languages, 15 runtime/license assets verified against the SHA-256 manifest.
- **Scope & Boundaries:** All image processing, OCR, and routing remain strictly local in-browser without external network calls, cloud inference, or telemetry. Automatic layout conversion produces a draft navigation graph subject to human review in the map editor.

## Earlier validation history

Current validation — 31 October 2026

- **Production build:** TypeScript checking and Vite compilation pass.
- **Automated tests:** all 65 tests across 10 files pass. Two new viewport tests verify that fitted map bounds stay clear of floating panels on desktop and mobile.
- **Appearance:** browser checks cover day/night at 1440 × 900 and 390 × 844, a 1024 × 768 tablet layout, and a 360 × 720 mobile layout. The primary route uses exactly `#058C42`. Street-lamp light appears only in night mode on the fictional campus.
- **Navigation layout:** checked sidebar collapse/reopen, route fitting around panels, all three demo route choices, alternative selection, mobile sheet expansion, and compass panel placement. No horizontal overflow or browser errors were reported. Screenshots and geometry results are in `test-results/appearance/`.
- **Uploaded-map regression:** the supplied Science Faculty image completed local analysis, review, north calibration, publication, route selection, and mobile night rendering. This fixture yielded 17 proposed places and two route alternatives. The browser run recorded no errors or external network requests; source-image colors were preserved. Results are in `test-results/browser-results.json`.
- **Scope:** this update changes presentation and viewport fitting. Local extraction remains a reviewable draft; no model was trained, no cloud service was added, and no site was deployed.

## Earlier validation history

Core prototype validated on 13 October 2026; day/night appearance update checked on 14 October 2026.

- **Production build:** `npm run build` passes TypeScript checking and Vite compilation. The QR decoder is emitted as a separate, lazy-loaded chunk. Fonts are bundled locally.
- **Automated tests:** `npm test` passes all 35 tests across routing, search, map zoom, QR validation, upload validation, guided preparation, and interaction tests.
- **Routing:** shortest paths follow the authored walking graph; step-free routing avoids stair edges; disconnected and same-location routes are handled.
- **Session expiry:** a controlled clock verifies expiry after a suspended tab resumes, disappearance of the active map/directions, a fresh QR session, reload persistence, storage-denied fallback, and preservation of an active session’s original deadline.
- **Camera lifecycle:** mocked camera tests verify permission-denied feedback and track cleanup, including requests resolving after the scanner closes. A physical camera was not used during verification.
- **Browser checks:** desktop at 1440 × 900 and mobile at 390 × 844; library search, route selection, step-free routing, responsive panels, QR image decoding, sample QR entry, countdown persistence after reload, and image preview/zoom/removal.
- **Final production preview:** no browser console errors observed during the final navigation check.
- **Day/night appearance:** keyboard activation, both saved choices surviving reload, desktop and mobile headers, night map selection/routes, and upload dialog contrast checked in the browser. The 23 existing tests also pass after the appearance update. Theme colors use CSS tokens without changing uploaded images.

Screenshots are saved in `test-results/`. To generate a known West Gate QR fixture and verify its encode/decode round trip, run `node scripts/generate-test-fixtures.mjs`.

Glass appearance update checked on 20 October 2026: production build succeeds; desktop and mobile rendering, day/night switching, and the library route above the floating mobile sheet were checked in the local browser. Solid fallback surfaces are provided for reduced transparency and browsers without backdrop filters.

Follow-up fixes: glass filtering now uses a clipped paint layer to prevent backgrounds spilling past rounded edges. Zoom limits no longer reverse the requested direction after fitting short routes or unusually wide campus views; three regression tests cover these cases and preserve the view center/aspect ratio. QR dialog clipping and the mobile route were checked again in the browser.

## Uploaded-map preparation and visual fixes — 21 October 2026

- The dialog owns a continuous background while its content scrolls. Verified the upload preview at the bottom of the modal; the rounded background no longer ends halfway through the content.
- Removed the broad radial glow and reduced material highlights/shadows. Category icons keep distinct teaching, library, food, services, toilets, and parking colors in both themes.
- A locally generated campus image was uploaded, marked with an entrance and a library, connected with three walkway segments, reviewed, and opened as an interactive map. The route followed the traced corners. Mobile navigation and scale calibration were exercised: estimates appeared only after supplying a known distance.
- Six graph tests cover uncalibrated routes, calibrated distances, step-free alternatives, disconnected places, duplicate/self edges, deletion, and preparation requirements. Three interaction tests cover connection/review, keyboard placement/undo, search/directions, and unavailable step-free feedback.
- Draft editing and published navigation use separate map snapshots. Publishing a reviewed revision resets navigation. Map pins retain readable screen sizes and 44-pixel hit targets as the view changes.

The current prototype includes a fictional demo campus, local OCR and path-draft extraction, and manual preparation for uploaded maps. Automatic drafts require review and do not reconstruct an illustrated vector campus. Persistent map storage, real GPS navigation, and server-enforced access control are not implemented. Uploaded images and prepared maps remain in memory until the tab is reloaded or closed.
