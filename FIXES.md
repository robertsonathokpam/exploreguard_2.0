# Prototype correctness fixes — 30 October 2026

Base: b104460097e04d4dd5e23f1eac4eec65d04578ad
Branch: fix/honest-prototype-results

## Implemented

- Vision: remove random detection fallback; preserve zero detections; separate immutable source image from annotated display; preserve aspect ratio; explicitly request up to 200 detections at threshold 0.35; report model failures; discard stale results when an image changes; release camera tracks; optional visible-area density; disable unsupported sector synchronization and remove the 1,250 multiplier. Increasing the detection limit does not prove improved model accuracy.
- Emergency requests: unknown GPS remains unknown; remove invented ETA and ambulance confirmation; atomic Firestore writes using stable document IDs; protect against double submission; show server-confirmation pending on timeout; save a local pending copy when storage permits; explicit restore/retry for the latest saved request under the signed-in account. No background delivery guarantee or complete offline queue is claimed.
- Text analysis: cloud requests require explicit action, have a timeout and basic schema validation, and discard stale responses. Local matching does not invent pulse measurements. Unknown or negated text returns an unclassified result requiring human review. This conservative handling can also classify serious descriptions containing negation as unknown: it does not implement multilingual clinical language understanding.
- Clinical display: remove speculative response time and withhold treatment instructions pending qualified review. Experimental categorization remains available for fictional demo cases. Backend data and historical category constants are not clinically validated.
- Hazards: reject invalid numerical inputs, adjust east-west slope calculation for latitude, convert three-hour rainfall totals to an hourly average, remove fabricated dynamic elevation/shelter fallbacks, distinguish sample weather and mapped unverified facilities. Dashboard uses an explicitly labelled sample scenario instead of combining Imphal weather with arbitrary GPS coordinates.
- Rendering: escape stored booking values before HTML insertion and remove dynamic inline booking-ID handlers. Clinical model output is no longer rendered as first-aid HTML.
- Presentation: visible prototype limitations on affected pages; corrected stale test summary.

## Run locally

Use Node.js 20 or newer (Node 24 was used for this review).

```sh
npm test
python -m http.server 8000
```

On Windows, use `py -m http.server 8000` if `python` is unavailable. Open http://localhost:8000.

Use fictional records and a separate Firebase test project. Configure your own Firebase Auth and Firestore settings and authorized domains. Copy `config.example.js` to `config.js` if you need local API configuration. Never commit private credentials. The supplied Firebase web configuration already existed in the repository and is not a security-rules audit.

## Validation completed

`npm test` passes:
- 56 calculation assertions, with revised expectations for ambiguous text and the non-official briefing label.
- 12 regression/workflow tests covering invalid input, negation, rainfall, slope latitude, escaping, zero detections, model failure, clean repeated scans, stale image results, denied GPS, database rejection and delayed acknowledgment.

Workflow tests execute the actual JavaScript controllers in isolated Node VM contexts with mocked DOM/model/database adapters. No live Firebase writes occurred. These tests do not prove actual model precision/recall, clinical correctness, browser layout or production integration.

Full browser verification could not run: the Chromium download failed in this environment. Before merging, test file upload, camera permission, repeated scans, real model loading, sign-in and Firestore rules in your own browser/test project. Model weights still require a first online download. External CDN availability and API keys remain deployment dependencies.

## Still required

- Evaluate person detection on manually annotated real photographs. Dense crowds may need a different validated counting model; benchmark before choosing one.
- Measured camera-area calibration, real flow tracking and reviewed routing data. The sector dashboard remains a scenario simulator.
- A service worker and full durable offline queue with retry lifecycle, deletion/retention controls and account isolation tests. The current local-copy restoration is a limited manual recovery mechanism.
- Qualified clinical review, complete language testing, reviewed first-aid translations and voice support.
- Real responder/PHC integration and acknowledgment, verified shelters and field studies.
- Production security-rule tests, expiring location-sharing links, GPS-write throttling and a complete security/privacy review. Do not interpret these fixes as a production security certification.
- Review existing static public-site marketing copy and historical documentation before public deployment.

## Deployment

Review these changes on their branch before merging into `main`. Keep your existing private `config.js` out of version control. Run the checks above, then merge through GitHub and verify the Render service's configured deployment branch. No Render settings or deployed Firebase rules were changed by this patch.
