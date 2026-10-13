# After work — release results

Date: 13 October 2026 · Candidate: 0.2.0

The source candidate completes the recovered app fixes and includes contributor documentation, licensing, CI, templates and a clear record of remaining risks.

## Verification

| Check                                             | Result                                                   |
| ------------------------------------------------- | -------------------------------------------------------- |
| TypeScript                                        | Passed                                                   |
| Routing/import/vision/search/expiry suite         | 20 tests passed                                          |
| Local English OCR smoke test                      | Both fixture labels recognized with geometry             |
| Production build                                  | Passed                                                   |
| Formatting                                        | Passed after formatting                                  |
| Fresh-install reproducibility                     | Passed from a source copy with no installed dependencies |
| Browser visual, gestures and camera               | Not verified in this environment                         |
| Android / iPhone / real-campus field tests        | Pending                                                  |
| Representative OCR accuracy and thermal benchmark | Pending                                                  |

The fresh-install run passed `npm ci`, TypeScript, all 20 tests, production build, OCR and formatting. `npm audit` reported zero known vulnerabilities at this check; that is not a security audit.

## What changed for a user

Uploaded layouts now produce candidate destinations, building shapes and paths instead of only a background image. Users compare them with the original and confirm the remaining paths before walking directions. Route choices are ranked by mapped length. Map rotation and compass reset are implemented. Theme colours cover the page and categories, search handles small typos, downloads are removed, and a live countdown accompanies local session cleanup.

## What we still need to solve

English OCR can miss labels, and road-like shapes can be wrong. Entrances need manual checking. Multiple images do not have cross-level connections. QR entry only serves the fictional demo. Imported maps are uncalibrated, all edges are bidirectional, and the app cannot enforce server-side expiry. There is no full offline reload support. Mobile/browser verification remains a release limitation.

Before a student pilot, use the device checklist, benchmark representative phones and maps, and obtain authoritative campus route data with review evidence. Before wider community promotion, configure a private reporting channel and verify the repository's hosted demo access.

The GitHub publication outcome is recorded after the remote branch update; source and live-site deployment are separate operations. Do not infer a new live version from a GitHub push alone.

## Publication verified

The 64-file public source release was merged through [pull request #1](https://github.com/MI1000-67/uniway/pull/1). Its [GitHub CI run](https://github.com/MI1000-67/uniway/actions/runs/38436813980) completed successfully before merge. The merge commit is `2c89dd0773f4195256ff37fafbdf369fe62af828`.

The updated hosted app was separately packaged from Sites source commit `8eff7c8b595ea1107f45ef22a5c20865c15b3609` and deployed successfully at https://uniway-campus.mellowmite10.chatgpt.site. Its existing owner-private access was preserved. Browser/device/field limits listed above still apply.

Repository administration changes (topics, branch protection, Discussions and private reporting) and outreach remain pending. No outreach messages were sent.
