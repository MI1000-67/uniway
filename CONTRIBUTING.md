# Contributing to Uniway

Use Node 22.12 or newer and npm. From the project root:

```sh
npm ci
npm run engine:setup
npm run engine:check
npm run dev
```

On PowerShell, use `npm.cmd` if script execution policy blocks `npm`. Setup downloads eight pinned OCR language files and copies the installed worker/runtime to `public/ocr/`. It requires internet access only during asset setup. The app itself processes maps locally. No environment file or API key is needed.

Before submitting a change:

```sh
npm run check
npm test
npm run format:check
npm run build
```

Use `npm run test:watch` while developing. Use `npm run format` to format TypeScript, scripts and documentation; it deliberately leaves approved CSS colors/materials untouched. See [architecture](docs/architecture.md) and [testing](docs/testing.md).

Keep a change focused and explain the user-visible behavior, test evidence and remaining limitations. Extraction changes should add a synthetic failure case, including a negative example that must not produce a route. Do not submit private campus photos, access credentials or copyrighted fixtures without permission. Generated OCR assets, dependencies, local snapshots and browser reports are ignored.

Retain the imported engine's MIT copyright notice. The main project's owner should choose a project-wide license before a public release; the imported modules' notice does not license unrelated files. This workspace is prepared for contribution but has not been pushed or deployed by this migration.
