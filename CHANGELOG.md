# Changelog

## 2026-11-08 — Reviewed navigation and public demo

### Added

- Independent pedestrian and accessibility review for detected map connections.
- Exact map/version/place references for Connect-to-navigation actions.
- GitHub Pages deployment after type checks, unit tests, formatting, OCR asset verification, production build, and a synthetic browser workflow.
- Static-host navigation that survives refresh at `/uniway/#/connect`.
- Deployment instructions, failure contracts, and reproducible browser checks.

### Fixed

- Removed campus-title/filename presets and invented indoor room labels.
- Invalidated path reviews when a connected point moves; blocked routes on unreviewed or invalid prepared maps.
- Added wall-mask checks for simplified indoor connections and approach points.
- Cleared stale routes for unavailable Connect destinations; corrected Student Centre references.
- Kept OCR files on the app's origin under the deployment subpath.
- Corrected Connect notification claims and documented actual browser storage.

### Boundaries

- Automatic extraction creates a draft, not a verified campus. No Uniway model was trained.
- Willowbrook and Connect are demonstrations. Connect has no accounts, shared persistence, or messaging service.
- Browser session expiry is a user experience feature, not server-enforced access control.
- Approved colors, glass surfaces, and decorative demo lamps are preserved.
