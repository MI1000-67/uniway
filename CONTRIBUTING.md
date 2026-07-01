# Contributing to UniWay

Thank you for helping students spend less time getting lost. You do not need to solve a large problem to make a useful contribution.

## Before you start

Read the README and AGENTS.md. For a larger feature, open an issue describing the problem and an example journey. Small bug fixes can go straight to a pull request. Keep one focused branch and pull request per step so changes are easy to review.

Use Node 22, run `npm ci`, then `npm run dev`. Before submitting, run `npm run check`, `npm test`, `npm run build`, `npm run test:ocr`, and `npm run format:check`. Add a regression test when it proves the defect is fixed. Do not add a test that only repeats implementation details.

## What a helpful pull request includes

Explain who encounters the problem, what changes for them, and how you checked it. Mention browser or phone results separately from unit tests. If you used AI assistance, say what it helped with and what you personally reviewed. We care about understandable, verified work; do not invent working hours, reviewers or field results.

Use plain, friendly wording in the interface and docs. Avoid claims such as “perfect recognition” or “safe route” unless there is evidence to support them. Map images cannot prove that a path is walkable or step-free.

## Maps and fixtures

Use synthetic maps or layouts you have permission to publish. Remove names, student identifiers and restricted building details. Keep sample images small. Detected paths must remain candidates until a person reviews them. Do not add real campus data without a documented field review and permission.

## Good first contributions

Try the device checklist and report the exact result; improve empty-state wording; add an English OCR fixture with known expected labels; or suggest Tamil/Sinhala translations. Ask before adding a new dependency or a large language model.

We review changes as time allows. There is no promised response deadline. Please keep discussion respectful and explain disagreements with concrete examples.
