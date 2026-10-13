# UniWay

Use the forest/paper palette #F5F2EA #244E43 #202722 #A44F35. Keep the map as the primary product surface. Fictional campus data must remain labeled as a demonstration.

Theme changes use one root data-theme attribute flip. Set the theme before first paint. Theme preferences use a separate localStorage key from temporary session data. Optional View Transitions may use a 180ms fade with instant fallback. Scene switches use 80×40 tracks in 48px hit targets, transform and opacity only, 380ms cubic-bezier(0.22,1,0.36,1), staggered stars at 70ms, no glow or idle motion, visible focus, role=switch, and instant reduced-motion behavior.

Never infer safe navigable routes from image pixels alone. Uploaded floor plans require user-confirmed nodes and paths. No model runs continuously. No geolocation claim on an uncalibrated image. Session expiry clears this browser's session content; it cannot revoke exported files or screenshots. Expiry must run on resume as well as at regular intervals.

Keep app state and routing separate. No upload leaves the device. Do not add third-party tracking. Camera opens only following a user action and stops on modal close.

## Repository layout and checks

Keep reusable UI in src/components, image import in src/import, routing and validation in src/engine.mjs, and search in src/search.mjs. Tests live in tests; synthetic fixtures in tests/fixtures; build utilities in scripts; explanatory docs in docs; lifecycle reports in docs/reports; community templates and CI in .github. Keep dependencies, generated OCR runtime assets, dist, credentials and private uploads out of the public repository. The Sites manifest is a deployment identity; forks must not reuse it.

Use one focused branch/PR per step. Run check, test, build, test:ocr and format:check before release. State browser/device limits explicitly. Public source approval is already given for this project. Do not invent authorship, work-hour records or verification results. Keep documentation direct and human-readable.
