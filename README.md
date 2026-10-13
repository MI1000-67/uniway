# UniWay

**Find your way, feel at home.**

Starting university should feel exciting. Finding a lecture hall should not take half the morning. UniWay turns a campus layout into a searchable, interactive map, with walking routes and a temporary browser session.

This is an open-source prototype built with React, TypeScript and Vite. The included Greenfield campus is fictional. Real map imports need a person to check the labels, entrances and paths before directions are enabled.

## Try it locally

You need Node.js 22 LTS or a supported Node version at least 20.19, and npm.

```bash
git clone https://github.com/MI1000-67/uniway.git
cd uniway
npm ci
npm run dev
```

Open the local URL printed by Vite. The first start copies the English OCR model and worker from installed packages into `public/ocr/`. Images are processed in your browser. No API key or paid AI service is required.

For a production build:

```bash
npm run check
npm test
npm run build
npm run test:ocr
npm run preview
```

Deploy `dist/` to a static host at the origin root. Use HTTPS for camera access. The included QR image points to the original UniWay hosted demo; if you deploy elsewhere, regenerate that QR for your own origin. The copied share link uses your current origin.

## What works today

- Search destinations, categories and saved places. Search handles accents, small spelling errors and map aliases.
- Pan, zoom and rotate the map with controls, keyboard or two fingers. The compass resets orientation.
- Compare up to three loop-free routes, ranked by mapped distance, and filter for paths marked step-free.
- Import up to eight JPG, PNG or WebP layouts. On-demand local OCR reads English labels; a compact neural model reads upscaled text and colour matching links legend entries to buildings.
- Keep the original layout visible with numbered pins. Place ambiguous labels, move pins to entrances, remove false paths and trace walkways around bends.
- Open demo campus links through QR entry, with a link fallback when camera decoding is unavailable.
- Use day/night themes and a three-hour session countdown. Browser session data is cleared on expiry, including when you return to a sleeping tab.

## What to expect

OCR and path detection are suggestions. A photograph does not tell us whether a doorway is open, a route is safe, or a ramp meets someone's needs. Detected paths start unconfirmed; step-free access needs a separate check. Imported layouts have no geographic north or real-world distance scale. They show relative route lengths, not invented metres or arrival times.

Each image is a separate level. Cross-level routes, live location, published real-campus QR maps and full offline app loading are not implemented. Downloads have been removed. Once loaded, route calculation runs locally; reloading the app or loading OCR assets still needs the host unless the browser has retained them. This release is not an emergency navigation tool.

The hosted demo at https://uniway-campus.mellowmite10.chatgpt.site may require its owner's access. Public source does not automatically make that hosted instance public.

## Privacy

Uploaded map images remain in this browser. There is no analytics, external inference service or background location tracking. The camera starts after a button press and stops on close or page hide. The theme preference has its own storage key and survives session expiry.

Three-hour expiry is local cleanup, not server-enforced access revocation. It cannot erase screenshots, browser backups or files a person already copied. See [privacy and security](docs/privacy-and-security.md).

## Help us improve it

We welcome small, useful contributions: a reproducible bug, clearer wording, a test on a real phone, or a better import fixture. Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [roadmap](docs/roadmap.md) and the [device test checklist](docs/testing.md). Use only maps and photos you have permission to share.

## Project notes

- [60-hour plan and honest work log](WORKLOG.md)
- [Layout import improvement report](docs/reports/04-layout-import.md)
- [Architecture](docs/architecture.md)
- [Before work: goals and risks](docs/reports/01-before-work.md)
- [During work: findings and decisions](docs/reports/02-during-work.md)
- [After work: results and limits](docs/reports/03-after-work.md)
- [Bug register](docs/bug-register.md)
- [Community and outreach plan](docs/community-plan.md)
- [Changelog](CHANGELOG.md)

## License

UniWay application code is available under the [MIT license](LICENSE). Bundled fonts retain their SIL Open Font License notices. OCR dependencies and model data retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).
