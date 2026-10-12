# Layout import: what failed and what changed

Date: 13 October 2026 · Release candidate: 0.3.0 · [Issue #3](https://github.com/MI1000-67/uniway/issues/3)

## Before work

The supplied small campus layout did not turn into a faithful interactive map. Text was too small for the original reading pass, the importer did not connect the colour legend to buildings, and the simplified view hid useful details. Outline and sidebar marks could also become false path candidates.

The goal was to preserve the real drawing, improve suggested destinations, and make corrections practical. Automatic conversion cannot establish which doors or walkways people can actually use.

## During work

We kept the existing local neural OCR approach. The English reader now uses the compact quantized LSTM model from the already installed language package. It loads for an import and terminates afterwards. There is no API key, remote inference call or continuous model loop.

The source image is kept separately from a reading canvas, which is enlarged up to three times and capped at 2,400 pixels on the long side. Shape analysis uses up to 640 pixels. Separate horizontal and vertical scale factors keep OCR boxes aligned after rounding. Colour clusters find legend swatches and candidate buildings. Similar repeated colours stay unresolved instead of being assigned arbitrarily.

In a local Node diagnostic using the supplied layout and a Lanczos-upscaled reading image, all 12 legend names were recovered. The new matcher suggested 8 building positions and retained 4 ambiguous labels for manual placement, with no path candidates. These numbers describe one diagnostic, not browser accuracy, entrance accuracy or a benchmark across campuses. Browser canvas resampling can produce different OCR results. The private upload is not committed to the public repository.

The original map is now the default background. Numbered pins reduce label clutter. The review panel keeps unresolved names; choosing one lets a person place it at its entrance. Existing pins can be moved. A walkway can be drawn through multiple bends, and the last bend can be undone. Moving an entrance clears confirmation and step-free status for attached paths.

## After work

Local release checks passed: TypeScript, all 25 routing and import tests, the actual local OCR model smoke test, formatting and the production build. The new synthetic cases check distinct and ambiguous colour legends, image alignment, sidebar/frame rejection, pin movement, review invalidation and preservation of path bends and unresolved labels.

Browser visual, pointer, keyboard and phone verification remains pending in this environment. A maintainer should reimport the original image, inspect all suggested pins, place unresolved labels, move pins to entrances, trace walkways, review the map and test routes on a real device before a campus pilot. Existing sessions are not silently reprocessed; upload the image again to run the new reader.

Remaining limits: English OCR, heuristic colour matching, ambiguous repeated colours, imperfect recognition of tiny building codes, no real-world distance or north calibration, no cross-image routing and no field-verified accessibility data. Further AI work should start with a consented, labelled evaluation set and compare error rates and phone performance before adopting a larger model.

This work was performed on 13 October. It is not included as historical work in the requested May 10–October 12 window. See the [60-hour plan](../../WORKLOG.md) for the distinction between budget and recorded time.
