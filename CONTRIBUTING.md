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

The main project is licensed under the root MIT `LICENSE`. Retain the imported engine's separate MIT copyright notice and third-party asset licenses. Do not include private map fixtures in contributions. This correction phase does not push or deploy the project.
