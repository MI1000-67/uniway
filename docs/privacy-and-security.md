# Privacy and security boundaries

We want users to understand what the app actually protects.

Uploaded images, detected labels, edited paths and saved places stay in this browser's memory and IndexedDB. OCR runtime files are served by the app host; the app does not send images to an inference API. Theme preferences are stored separately. There is no third-party tracking added by UniWay.

The countdown clears browser session records when the app runs and observes expiry. A closed app cannot execute cleanup, so records may remain on disk until it is opened again. Browser storage, device backups and screenshots are outside this cleanup guarantee. The app cannot promise forensic erasure or revoke copied content. Do not upload confidential plans on a shared device.

Camera access follows an explicit button press. Tracks stop on modal unmount or page hide. Pending permission requests are invalidated so a late grant cannot keep a camera stream alive. BarcodeDetector availability varies by browser; paste-link entry remains available. QR links only open this origin's fictional demo. Real map distribution and signed map IDs need a separate design.

Raster import has size bounds. JSON map input is sanitized and remote/SVG image references are rejected. These checks are defensive boundaries, not a completed penetration test. Local confirmation is editable client data and is not a trusted university review record.

Real deployments need a named data owner, permitted building details, current access conditions and an authoritative review process. One-way routes, closures, ramps and stairs need richer graph metadata before use on a real campus.
