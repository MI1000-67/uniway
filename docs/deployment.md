# Hosting Uniway

Uniway is a static browser app. The public demonstration is hosted at <https://mi1000-67.github.io/uniway/>. Publishing the app does not upload visitors' maps: image processing runs on their devices. The hosting provider receives ordinary page/asset requests; see [privacy boundaries](privacy-and-security.md).

## GitHub Pages

The repository's Pages source is **GitHub Actions**. `.github/workflows/ci.yml` verifies pull requests and builds/deploys `main`. Deployment uses the `github-pages` environment and a narrowly scoped Pages token. Actions are pinned to commit SHAs; Dependabot can propose updates.

The build installs the lockfile with `npm ci`, provisions and checks pinned OCR assets, runs TypeScript, tests, formatting, and the production build. A Chromium workflow then exercises actual local OCR, path review, accessibility review, Connect routing, refresh, and mobile/night rendering. Only the verified `dist/` artifact is published. Private fixtures, `node_modules`, and source files outside the build are not deployment artifacts.

`UNIWAY_BASE_PATH=/uniway/` selects the project URL at build time. To fork or rename the repository, update that value in the workflow and links in the README. A root/custom-domain deployment uses `/` instead. Connect uses a hash route; direct reload needs no server rewrite. Uploaded images are intentionally lost on reload.

## Reproduce the hosted build

Use Node 22.12+ and install Microsoft Edge, or install a Playwright Chromium browser with `npx playwright install chromium` and set `UNIWAY_BROWSER_CHANNEL=chromium`.

```powershell
npm ci
npm run engine:setup
npm run engine:check
$env:UNIWAY_BASE_PATH = "/uniway/"
npm run build
npm run preview -- --port 4173
```

In another terminal:

```sh
npm run test:browser -- http://127.0.0.1:4173/uniway/
```

For macOS/Linux, prefix build and preview commands with `UNIWAY_BASE_PATH=/uniway/`. The browser check can also target the public URL. It generates its own synthetic map in memory and never uploads a private fixture. Reports are ignored under `test-results/phase1/`.

## Operations and failure behavior

- Check the repository's **Actions** tab for the exact failing step. A failed verification prevents deployment; the previously published artifact remains live. Browser failures retain a seven-day report.
- Missing OCR files cause preparation to offer retry/manual review. Run `engine:setup` and `engine:check`; never substitute a third-party runtime URL.
- For a regression, revert the offending commit on `main` using a normal reviewed commit, then let verification deploy the replacement. No force-push is needed.
- The production HTML embeds a Content Security Policy restricting scripts, fonts, workers, images and connections to the documented local sources. This policy is also tested by running the built app. GitHub Pages does not apply Vite's custom HTTP headers. CSP directives that require response headers and server-enforced authentication are outside this static deployment.
- Do not add credentials to `VITE_*` variables: they are public browser bundle values. This app requires no secrets or inference API keys.

## Release checklist

Verify the workflow succeeded, open both app modules, refresh Connect, process the synthetic map, and inspect the console/network report. Record actual results in [VALIDATION.md](../VALIDATION.md). Physical Android/iPhone sensors, real campus access, extraction accuracy and full accessibility conformance still require separate validation.
