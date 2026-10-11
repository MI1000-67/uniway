# Changelog

## 0.3.0 — 13 October 2026

Small map imports now use a higher-resolution OCR pass and conservative colour-legend matching. The original layout stays visible by default, with numbered pins and a queue for ambiguous labels. Pins can be moved to entrances and walkways can be traced around bends. Moving a pin clears review and step-free claims for attached paths. Sidebar scale marks, thin outlines and white space are excluded from path proposals.

The local English model is now the compact quantized LSTM model supplied by the existing dependency. No API service or image upload was added. Added regression coverage, a layout import report and a 60-hour planning record with no invented historical hours.

## 0.2.0 — 2026-10-13

- Added on-device English OCR and layout processing, with candidate paths and human review before directions.
- Added ranked route alternatives, curved path geometry, map rotation and compass reset.
- Applied theme tokens to page and category colours; kept the scene switch full-sized on mobile.
- Removed map download controls and updated privacy wording.
- Added tolerant search, aliases and a live session clock.
- Hardened malformed imports, candidate confirmation and camera cancellation.
- Added regression tests, an OCR smoke test, CI and contributor documentation.

This is the first public source release. Browser, real-device and real-campus verification remain open; see the release report.

## 0.1.0

Initial hosted prototype with fictional campus search, route steps, manual map editing, QR entry and temporary sessions.
