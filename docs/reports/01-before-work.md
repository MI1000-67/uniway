# Before work — goals and release plan

Date: 13 October 2026

The goal is a public UniWay repository that someone can run, understand and help improve. Fixing the reported app problems comes before uploading the source. The owner explicitly approved public disclosure of the source and assets.

## Starting point

The public `MI1000-67/uniway` repository contained its initial commit. A recovered 0.1 source copy and a newer local workspace were available. The newer workspace contained unfinished OCR, route, rotation and theme changes, and failed TypeScript checking. Earlier assistant messages claimed the bug list was retained; we recovered the app requirements before using them as the fix scope.

## Work order

1. Audit the recovered app requirements and in-progress code.
2. Complete fixes for import, routes, rotation, theme, downloads and timer; address failures discovered during review.
3. Add focused regression tests and a local OCR smoke test.
4. Add reproducible setup, contribution guidance, licensing, CI, templates and plain-language reports.
5. Verify the candidate, publish the full source to GitHub, and record unresolved limits honestly.

## Risks we expected

| Problem                                       | How we planned to handle it                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| OCR mistakes or false roads                   | Candidate graph, source comparison and explicit human review                       |
| Device heat / slow imports                    | On-demand workers, bounded raster size, cancellation; benchmark phones later       |
| Public release exposes private data           | Use fictional/synthetic fixtures; omit credentials, runtime files and user uploads |
| Contributors cannot reproduce build           | Lockfile, Node guidance and CI commands                                            |
| “Three hours” sounds like security revocation | Explain local cleanup and copied-content limits                                    |
| People cannot find or contribute              | Clear README, templates, focused starter tasks and practical outreach plan         |

## Acceptance goals

TypeScript, regression tests, local OCR smoke test, production build and formatting must pass. Source publication must be verified by GitHub's branch head. Browser and field tests must be reported as pending if unavailable. No invented AI benchmark, working-hours claim, adoption figure or safety certification belongs in the release.
