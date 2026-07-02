# During work — findings and decisions

Date: 13 October 2026

The initial audit found a TypeScript mismatch: route results could omit edge indices, while the route option component required them. The component contract now accepts that shape. The existing ten tests passed once checking was repaired.

The newer workspace already contained substantial OCR and map interaction work. We completed and reviewed it rather than pretending it had all been written from scratch in this turn. Labels are read locally; path candidates remain unconfirmed. Imported maps do not get made-up metres, geographic north or live positioning.

Review exposed additional defects. Tall images could create unnecessarily large raster jobs, a late camera permission grant could outlive the scanner, blank IDs and malformed junction lists needed rejection, and detected paths without a confirmation flag were too easy to trust. The source now bounds both image dimensions, invalidates pending camera work, validates those inputs and requires explicit detected-edge confirmation. Ending a session aborts imports as well as clearing data.

We added tests for route alternatives, polyline reversal, candidate review, blank layouts, synthetic road geometry, label placement and tolerant search. A separate OCR fixture proves that the installed English model returns text and geometry. It does not prove recognition accuracy on arbitrary campus photos.

The repository now documents what works, what remains uncertain and how a contributor can reproduce checks. CI runs the same commands; issue and pull request templates ask for useful evidence. Documentation uses direct, conversational language. We have not fabricated personal authorship, field research, reviewer identities or work-hour records.

Browser control for the managed Sites preview was unavailable, so no visual or phone-camera test result is claimed. Real map accuracy, device performance and survey-workbook validation remain separate follow-up work.
