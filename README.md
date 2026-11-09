# UniWay — Smart Campus Navigation & Community Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646cff.svg)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Tests-156%20Passing-brightgreen.svg)](https://vitest.dev/)
[![Zero-Cloud Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-058C42.svg)](docs/privacy-and-security.md)
[![Accessibility](https://img.shields.io/badge/Accessibility-WCAG%202.2%20AA-success.svg)](docs/architecture.md)

UniWay is a mobile-first, privacy-preserving smart campus navigation and community platform developed for the **GreenExE 4.0 Smart Green City Innovation Competition**. It pairs sub-second on-device graph routing with a campus community hub, designed for students, visitors, organizers, and campus newcomers.

Willowbrook University is a fictional demonstration campus; all paths, landmarks, and distances serve as realistic evaluation data.

---

## Key Capabilities

- **Zero-Cloud & 100% Local Inference**: All map rendering, OCR text recognition, geometry extraction, and graph pathfinding execute strictly in client browser memory. No telemetry, no cloud vision APIs, and zero user data persistence.
- **In-Browser HEIC / HEIF Mobile Map Conversion**: Upload iPhone and mobile camera floor plans (`.heic`, `.heif`, `.jpg`, `.png`, `.webp` up to 15 MB) directly. Converted client-side via code-split `heic2any` with strict local sandbox isolation.
- **Dijkstra & Yen's Multi-Route Navigation**: Computes the optimal shortest path via Dijkstra's algorithm along with up to two loop-free alternatives via Yen's K-Shortest Paths algorithm (solid emerald, dashed amber, dotted terracotta).
- **Step-Free Inclusive Routing**: One-click accessibility toggle eliminates staircases (such as the Central Library main stairs) and re-routes exclusively through wheelchair-accessible ramps, level footpaths, and elevators.
- **Turn-by-Turn Wayfinding with Traveler Beacon**: Step-by-step guidance cues with an animated pulsing emerald (`#058C42`) position marker and floating navigation chip.
- **Interactive Guided Tour (Visitor Walkthrough)**: A built-in 7-step interactive walkthrough that introduces visitors to the live campus map, landmark inspection, route options, and community integration.
- **UniWay Connect (Module B)**: In-app student marketplace and volunteer opportunity hub, featuring seamless location bridges directly to mapped campus buildings.
- **Approved Design Language**: Glass panels (`backdrop-filter: blur(24px)`), `#058C42` emerald accents, day/night mode with decorative warm street lamps, and responsive bottom sheets meeting WCAG 2.2 AA standards.

---

## Quickstart

### Prerequisites

- Node.js 20+ (LTS recommended)
- Windows PowerShell, macOS, or Linux terminal

### 1. Install Dependencies

```sh
npm install
```

### 2. Start Development Server

```sh
npm run dev
```

Open the local URL output by Vite (typically `http://127.0.0.1:5173/`).

### 3. Run Quality & Test Suite

```sh
# Type check without emission (0 errors)
npm run check

# Execute complete Vitest test suite (156 tests across 20 suites)
npm test

# Verify local offline OCR asset manifests
npm run engine:check

# Verify Prettier code formatting
npm run format:check
```

### 4. Build for Production

```sh
npm run build
npm run preview
```

---

## Interactive Feature Walkthrough

1. **Take the Guided Tour**: Click the **Tour** button in the top navigation header or click **"Take interactive tour"** on the Explore welcome card. Step through the 7 interactive stages with live map callbacks.
2. **Find a Destination**: Use the real-time search bar to search for `"Central Library"` or filter by categories (**Teaching**, **Library**, **Food**, **Services**, **Toilets**, **Parking**).
3. **Calculate Routes**: Select Central Library, click **Get directions**, and choose your starting entrance (e.g. South Gate or West Gate).
4. **Compare Route Alternatives**: Review up to three loop-free route alternatives. Toggle **Step-free route** to see stair-free ramp navigation.
5. **Turn-by-Turn Navigation**: Use the Next and Previous step controls on the floating route chip or click instruction items to follow the pulsing traveler beacon on the map.
6. **Upload Indoor Floor Plans**: Click **Upload a map**, select any campus floor plan or emergency diagram (including `.heic` and `.heif` mobile photos), and let the local engine extract room labels and suggest walkable path drafts.
7. **UniWay Connect**: Click **UniWay Connect** in the header switcher to view campus marketplace items, volunteer postings, and event announcements.

---

## Architecture Overview

```
src/
├── App.tsx                    # Root shell, header switcher, map coordination, responsive layout
├── CampusMap.tsx              # Interactive SVG campus map with route overlays and traveler beacon
├── VisitorTour.tsx            # 7-step interactive visitor walkthrough & keyboard navigation
├── RouteChoices.tsx           # Multi-route alternative selection (Dijkstra + Yen's K-Shortest)
├── UploadPanel.tsx            # Local image upload dropzone supporting JPEG, PNG, WebP, HEIC/HEIF
├── QRPanel.tsx                # Client-side QR scanner for 3-hour visitor access sessions
├── MapEditor.tsx              # Manual and guided map calibration, pin placement, and path review
├── PreparedMapExplorer.tsx    # Direction routing and search for user-prepared custom maps
├── heicConverter.ts           # Client-side in-browser HEIC-to-JPEG conversion via dynamic heic2any
├── routing.ts                 # Dijkstra pathfinding and turn-by-turn landmark cue generation
├── routeAlternatives.ts       # Yen's algorithm for loop-free alternative routes
├── campus.ts                  # Demonstration campus graph, entrances, nodes, and step-free paths
├── session.ts                 # 3-hour visitor session model and tamper-resistant countdown
├── appearance.css             # Glass panels, color tokens, responsive sheets, tour styling
├── glass.css                  # Layered backdrop-filter glass materials and night mode tokens
├── theme.css                  # Semantic CSS variables for day and night themes
├── connect/                   # Module B: UniWay Connect (marketplace, volunteer hub, bridges)
└── engine/                    # Local OCR, image binarization, corridor extraction, graph drafts
```

For detailed architectural contracts and design decisions, see [docs/architecture.md](docs/architecture.md) and [docs/navigation-contracts.md](docs/navigation-contracts.md).

---

## Privacy, Security & Local Execution Guarantee

- **Zero Cloud Leakage**: No images, map coordinates, search queries, or visitor identifiers are ever sent to remote cloud servers or third-party APIs.
- **Local HEIC Conversion**: `.heic`/`.heif` files are converted entirely in-browser using Web Worker threads.
- **Source Control Isolation**: Private uploaded maps (e.g. `*.heic`, `*.heif`, `55999.*`, `56002.*`) are permanently ignored in `.gitignore` and enforced by automated tests (`src/privacy.test.ts`).
- **Origin-Restricted Assets**: All OCR language training data and WebAssembly decoders reside in `public/ocr/` on the local application origin, validated with SHA-256 integrity manifests.

See [docs/privacy-and-security.md](docs/privacy-and-security.md) for full compliance specifications.

---

## Verification & Validation

The codebase maintains strict verification gates:

- **TypeScript**: `tsc --noEmit` exits with 0 errors in strict mode.
- **Vitest Suite**: 156 automated unit and integration tests passing across 20 test files.
- **Code Style**: 100% formatted under Prettier standards.
- **Production Build**: Verified Vite 6 production bundling with code-split vendor chunks.

Refer to [VALIDATION.md](VALIDATION.md) for empirical test outputs and benchmark logs.

---

## License

UniWay is open-source software licensed under the [MIT License](LICENSE). Source-derived modules in `src/engine/imported/` retain their original MIT notices.
