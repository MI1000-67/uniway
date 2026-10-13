# Bug register

This register covers the recovered application requests. “Implemented” describes source changes; it does not imply real-device verification.

| Report                                              | Change                                                                                | Evidence / remaining check                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Night mode leaves page/text colours wrong           | Replaced page and category colours with theme tokens; added upload-state dark colours | Source checked; visual contrast/device review pending          |
| Compass does nothing                                | Added rotation buttons, two-finger rotation and compass orientation reset             | TypeScript/build pass; gesture/device review pending           |
| Upload only adds a photo, no automatic map          | Local English OCR and building/path candidate processing; source review UI            | Synthetic OCR and vision tests pass; real maps not benchmarked |
| Need route choices                                  | Up to three ranked loop-free routes, distinct colours/patterns and lengths            | Unit tests verify ordering, uniqueness and filtering           |
| Remove downloads                                    | Removed export/download controls and corrected docs                                   | Source review; existing copied files cannot be revoked         |
| Session timer / expiry                              | Live countdown, absolute timestamp and resume checks; cancel import on end            | Expiry helper tests; lifecycle/device checks pending           |
| Search should tolerate misspellings/aliases         | Added accent normalization, one-edit word matching and aliases                        | Search regression passes                                       |
| Detected paths can be trusted too early             | Fail closed on missing detected-edge confirmation; review gate before walking         | Regression passes                                              |
| Tall image analysis costs too much                  | Bound both raster dimensions before worker analysis                                   | Source review; memory/thermal benchmark pending                |
| Camera grant arrives after close/hide               | Invalidate pending requests; discard late streams and detections                      | Source review; real camera test pending                        |
| Imported blank IDs/names or malformed junction list | Reject invalid input with a clear error                                               | Regression passes                                              |

Separate survey workbook findings (entrance references, reviewer/date/evidence, green-point references, row limits and readiness checks) remain outside this code release. Do not call that workbook approved or its exporter production-ready until those fixes are verified.
