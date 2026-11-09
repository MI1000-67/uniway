# Project: Uniway Campus Navigation & Visitor Showcase

## Architecture

- **App Shell & State**: `src/App.tsx` coordinates search, landmark inspection, routing modes, mobile bottom sheets, theme switching, and module switching (`Navigate` vs `UniWay Connect`).
- **Interactive Map Canvas**: `src/CampusMap.tsx` handles SVG rendering, viewBox manipulation, traveler beacon animations (`.traveler-marker-group`), and warm night lamps (`src/StreetLamps.tsx`).
- **Map Ingestion Pipeline**: `src/UploadPanel.tsx` and `src/uploads.ts` accept user maps, convert and normalize image data client-side on origin, and feed local Web Workers / Tesseract WASM.
- **Client-Side HEIC Converter**: `src/heicConverter.ts` provides local-only, in-browser decoding of `.heic`/`.heif` images to standard `image/jpeg` Blobs without cloud roundtrips or external network dependencies.
- **Routing Engine**: `src/engine/` provides Dijkstra, Yen's K-shortest paths (Shortest `#058C42`, Alt 1 `#b0843f`, Alt 2 `#b87563`), step-free accessibility planning, and local OCR.
- **Visitor Walkthrough Experience**: `src/tour/` delivers a non-intrusive 7-step guided tour orchestrating campus search, route alternatives, step-free access, and live turn navigation using approved design tokens (`#058C42`, `--glass-material`, 24px blur).
- **Design Tokens**: Defined in `src/appearance.css` and `src/glass.css` (`#058C42`, glass panels, warm lamps).
- **Community Hub**: `src/connect/` provides mock campus marketplace and volunteer coordination.

## Feature Inventory

| #   | Feature                          | Description                                                                                                                                           | Milestone | Source                 |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------- |
| 1   | Ambient Process Typing           | Declare `process` in `src/vite-env.d.ts` to resolve `TS2580` in `vite.config.ts`                                                                      | M1        | Survey Explorer 1      |
| 2   | Connect Tagline Alignment        | Fix `connect.test.tsx` line 84 regex/string to match `ConnectView.tsx` tagline                                                                        | M1        | Survey Explorer 1      |
| 3   | Code Formatting Cleanliness      | Format 6 modified/unformatted files with Prettier (`npm run format`)                                                                                  | M1        | Survey Explorer 1      |
| 4   | Clean Verification Pass          | Ensure `npm run check`, `npm test`, `npm run build`, and `npm run engine:check` pass cleanly with code 0                                              | M1        | Survey Explorer 1      |
| 5   | HEIC Decoder Integration         | Install `heic2any` (or zero-dependency in-browser worker) and configure client-side decoder                                                           | M2        | Survey Explorer 2      |
| 6   | In-Browser HEIC Upload           | Update `UploadPanel.tsx` & `uploads.ts` to accept `.heic`/`.heif` files (handling empty Windows Chromium MIME)                                        | M2        | Survey Explorer 2      |
| 7   | Local Image Conversion           | Convert HEIC files to `image/jpeg` Blobs locally on origin for canvas normalization and OCR                                                           | M2        | Survey Explorer 2      |
| 8   | Map Fixture Privacy & Gitignore  | Update `.gitignore` with `*.heic`, `*.heif`, `55999.*`, `56002.*` to guarantee private files are never committed                                      | M2        | Survey Explorer 2      |
| 9   | HEIC & Privacy Automated Tests   | Add unit tests for HEIC file acceptance, conversion, and git tracking assertions                                                                      | M2        | Survey Explorer 2      |
| 10  | Visitor Tour Component           | Create `src/tour/VisitorTour.tsx` with 7 guided steps using glass styling and `#058C42`                                                               | M3        | Survey Explorer 3      |
| 11  | Tour Orchestration in App        | Connect tour launch button, active state, and programmatic navigation in `App.tsx`                                                                    | M3        | Survey Explorer 3      |
| 12  | Navigation Workflow Tour Steps   | Step through Welcome, Search/Filter, Landmark Inspect, Route Alternatives, Step-Free, Live Turn Guidance                                              | M3        | Survey Explorer 3      |
| 13  | Tour Keyboard & Dismissibility   | Support `Esc` dismiss, `Arrow` keys step progression, non-blocking click-through                                                                      | M3        | Survey Explorer 3      |
| 14  | Tour Automated Tests             | Add Vitest tests validating tour rendering, step advancement, navigation triggers, and dismissal                                                      | M3        | Survey Explorer 3      |
| 15  | Showcase README.md Upgrade       | Upgrade `README.md` to professional showcase standard with badges, feature matrix, developer verification table, tour instructions, and privacy rules | M4        | Survey Explorer 3      |
| 16  | Documentation & Validation Sync  | Update `VALIDATION.md` and docs to reflect current test metrics and local verification                                                                | M4        | Survey Explorer 3      |
| 17  | Comprehensive E2E Test Suite     | Design 4-tier requirement-driven opaque-box test suite published via `TEST_READY.md`                                                                  | E2E Track | Top-Level Orchestrator |
| 18  | Final E2E Suite Pass & Hardening | Pass 100% of E2E test suite (Tiers 1-4) and adversarial coverage hardening (Tier 5)                                                                   | M5        | Top-Level Orchestrator |

## Milestones

| #   | Name                                                      | Scope                                                                                                                                                          | Dependencies    | Status      |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------- |
| M1  | R1 Error Resolution & Build Stability                     | Ambient typing in `src/vite-env.d.ts`, tagline alignment in `connect.test.tsx`, format check, verifying `npm run check`, `npm test`, `npm run build` pass 100% | none            | DONE        |
| M2  | R2 In-Browser HEIC Upload & Privacy                       | `heic2any` integration, `.heic`/`.heif` file input handling, local blob conversion, `.gitignore` privacy safeguards, automated unit/integration tests          | M1              | IN_PROGRESS |
| M3  | R4 Visitor Interactivity & Guided Walkthrough             | `src/tour/` component, 7-step guided navigation tour, App.tsx integration, design token compliance (`#058C42`, glass panels), unit tests                       | M1              | PLANNED     |
| M4  | R3 Repository Presentation Upgrade                        | Professional `README.md` showcase, `VALIDATION.md` updates, DX docs, verification command matrix, privacy assurances                                           | M1, M2, M3      | PLANNED     |
| E2E | E2E Testing Track                                         | Requirement-driven opaque-box test suite (Tiers 1-4: Feature, Boundary, Combinatorial, Workload) -> `TEST_READY.md`                                            | M1              | PLANNED     |
| M5  | Final Milestone: E2E Verification & Adversarial Hardening | Phase 1: Pass 100% of E2E test suite (Tiers 1-4). Phase 2: Adversarial coverage hardening (Tier 5)                                                             | M2, M3, M4, E2E | PLANNED     |

## Interface Contracts

### `heicConverter` (src/heicConverter.ts)

- `isHeicFile(file: File): boolean`
  - Accepts `File` object.
  - Returns `true` if `file.type === "image/heic"`, `file.type === "image/heif"`, or `/\.hei[cf]$/i.test(file.name)`.
- `convertHeicToJpegBlob(file: File): Promise<Blob>`
  - Accepts `.heic`/`.heif` `File` object.
  - Uses client-side `heic2any` to emit `image/jpeg` Blob with quality `0.92`.
  - Rejects with descriptive error if file is malformed.

### `VisitorTour` (src/tour/VisitorTour.tsx)

- Props:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `currentStep: number`
  - `totalSteps: number`
  - `onNext: () => void`
  - `onPrev: () => void`
  - `onSelectStep: (step: number) => void`
  - `tourStepData: TourStepDefinition`

### Privacy Policy & Fixtures

- Private files `55999.heic` and `56002.heic` are strictly excluded in `.gitignore`.
- Automated test verifies `git ls-files | grep -iE '(55999|56002|\.heic|\.heif)'` returns empty.

## Code Layout

- `src/vite-env.d.ts`: Ambient TypeScript definitions (Node process env).
- `src/connect/ConnectView.tsx` & `src/connect/connect.test.tsx`: Tagline alignment.
- `src/heicConverter.ts`: Client-side HEIC conversion utility.
- `src/UploadPanel.tsx` & `src/uploads.ts`: Map upload handling and MIME detection.
- `src/tour/VisitorTour.tsx` & `src/tour/tourSteps.ts`: Interactive tour UI and step configurations.
- `src/tour/VisitorTour.test.tsx`: Automated tour tests.
- `src/test/heicUpload.test.ts` & `src/test/privacy.test.ts`: HEIC conversion & privacy safeguard tests.
- `README.md` & `VALIDATION.md`: Public documentation and verification results.
- `e2e/`: Opaque-box E2E test suite.
