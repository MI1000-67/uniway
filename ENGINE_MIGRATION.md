# Core migration: anti uniway → main Uniway

Main workspace: `C:/Project/experiment`. Source: `C:/Project/anti unieway/uniway-date-publish`. The approved green/glass UI remains the main interface.

## November 2026 correction

Subsequent core work reintroduced title-triggered layouts and automatic accessibility. The approved correction removes those presets again while retaining generic OCR/geometry work. Indoor linework can now propose reviewable paths constrained by detected walls; it does not establish verified corridors. Uploaded edges carry independent pedestrian/accessibility review, and both are invalidated by endpoint movement. See [current contracts](docs/navigation-contracts.md) and the dated validation entry. The original migration analysis below is historical context, not a current accuracy claim.

## Analysis and decision

The source adds useful palette segmentation, color-legend matching, unresolved labels, indoor room candidates, and Unicode search. Its 49 tests passed during inspection, but some tests expect hardcoded campus outputs: a blank image named `science-faculty-map.jpg` produced 23 places and 77 edges. Its indoor routine also connected sealed rooms through walls. Those behaviors cannot be treated as extraction accuracy.

Port the reusable algorithms into typed, pure modules; remove campus/filename presets and inferred room connections. Retain main's local OCR asset configuration, cancellation, targeted number recognition, reviewed graph routing, north/scale calibration, and UI. No cloud fallback, automatic floor connections, or persistent image storage.

## Implementation plan

1. Preserve a local source/UI snapshot and record the migration boundary.
2. Port palette, generic directory matching, and room candidates with input-pixel coordinates and bounded outputs. Keep ambiguous names for manual placement.
3. Integrate candidates into the OCR worker pipeline. Merge evidence without duplicating names or overriding conflicting keys. Indoor images get room candidates, never guessed routes.
4. Add placement of unresolved labels and relocation of pins, resetting review/accessibility when geometry changes. Keep original map imagery and existing design tokens.
5. Migrate ranked Unicode search, add reproducible OCR asset checks and contributor documentation, and verify unit tests, build, browser workflows, and unchanged theme files.

## Acceptance

- Blank files and filenames cannot manufacture campus data.
- Ambiguous labels remain recoverable; sealed rooms do not gain routes through walls.
- Original-image coordinates survive nonuniform resize rounding.
- Analysis and search remain local; preview/manual correction remain available.
- Current day/night colors and decorative lamps stay intact.
- Contributor setup is documented and checks run without private fixtures.

Results and remaining limits are recorded in `VALIDATION.md` after integration.
