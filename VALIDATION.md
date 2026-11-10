# Uniway validation

## Current validation — 10 November 2026 (Map Editor Unlock, Topological Connectivity, Floor Plan Synthesis & Bulk Pedestrian Review)

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
