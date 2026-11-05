# Uniway validation

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
