# Third-party notices

`src/engine/imported/` adapts palette segmentation, connected components, generic directory matching and room-region detection from the supplied `anti unieway/uniway-date-publish` project. Copyright (c) 2026 UniWay contributors. The complete MIT license is retained in [src/engine/imported/LICENSE](src/engine/imported/LICENSE). `src/search.ts` adapts that project's search approach with Unicode-preserving normalization, deterministic ranking and constrained typo handling under the same notice.

Tesseract.js and Tesseract.js-core retain their installed licenses. Language data comes from `tesseract-ocr/tessdata_fast`, release 4.1.0, under Apache 2.0. Setup copies their notices into `public/ocr/` and records the language provenance and SHA-256 values. `scripts/ocr-assets.json` records the expected values used by the offline checker.

DM Sans and Manrope are bundled through their Fontsource packages; preserve their SIL Open Font License notices when distributing assets. Other packages retain their own licenses in the installed dependency tree. This file scopes imported material and does not make a project-wide license grant.
