# Third-party notices

UniWay's MIT license applies to its application code. It does not replace dependency or font licenses.

| Material                   | Origin                     | License / notice                                                                                    |
| -------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| Inter fonts                | Inter Project Authors      | `public/fonts/inter-OFL.txt` (SIL OFL 1.1)                                                          |
| Newsreader fonts           | Newsreader Project Authors | `public/fonts/newsreader-OFL.txt` (SIL OFL 1.1)                                                     |
| React / React DOM          | Meta and contributors      | MIT; packaged dependency license                                                                    |
| Tesseract.js and core      | Tesseract.js contributors  | Apache-2.0; packaged dependency notices                                                             |
| English trained data       | `@tesseract.js-data/eng`   | Preserve installed package/model notices; MIT package metadata; upstream trained-data notices apply |
| Vite, TypeScript, Prettier | Their respective projects  | Preserve packaged license files                                                                     |

`npm ci` retrieves dependencies according to the lockfile. `scripts/prepare-ocr.mjs` copies local OCR runtime/model assets into the build. Builds include runtime licenses and model package metadata under `ocr/licenses/`. Redistributors should retain their installed package license notices when shipping those assets. The campus illustration and OCR fixture in this repo are synthetic; no real university layout is included.
