# Prototype corrections

## Current revision: remove unsupported outputs

The user reported severe undercounting on an illustrated crowd, a broken image layout, unsupported hazard probabilities at zero rain, and a medical page showing an invented facility and distance. This revision changes the behaviour, rather than adding fixed answers:

- Photo viewport text is outside the canvas container; images retain their aspect ratio and metrics wrap on small screens.
- RT-DETR R18 (quantized ONNX, browser WASM) is selectable alongside full MobileNet V2. RT-DETR is an experimental candidate, not an asserted accuracy improvement on this project's images. The first model download requires internet. Model failures remain unavailable without switching models silently or generating detections.
- Removed illustrated presets, sector count/flow/route samples from the active tracker and removed the automatic detections/area density calculation. A single image is not a calibrated venue sensor.
- Replaced arbitrary sigmoid percentages and hardcoded terrain/soil inputs with actual Open-Meteo provider data. Weather and elevation fail independently, absent values stay unknown, and source/time/units are displayed. No disaster probability is output. Removed dashboard sample percentages too.
- Removed the medical keyword classifier from the active report flow. A fictional report remains unassessed. Optional Gemini calls summarize supplied observations without requesting treatment, diagnoses, facilities or priority labels. Missing keys, failed calls and invalid replies do not trigger a fabricated local result. Clinical review is still required; model summaries can be wrong.
- Removed invented medical facility, 420 m distance, offline-first-aid claims and unverified static district directory. Unknown observations are explicit, including bleeding and breathing. The national dial link remains separate from demo recording.
- Preserved atomic/idempotent Firestore demo writes, local pending-copy restoration and explicit unconfirmed/pending states from the previous revision. No responder is connected.

## Automated verification

`npm test` includes 56 **legacy simulation assertions** and 28 regression/controller tests. Legacy assertions exercise old formulas, which the active pages no longer import. They are not a forecast, language or clinical validation report.

New tests cover real controller behaviour with isolated DOM/Firebase/model adapters: empty detections, inference failures, stale images, clean rescans, database rejection/timeouts, Windows CRLF loading, provider missing values vs explicit zeros, model adapter coordinates, unsupported medical assignment removal, Gemini failure/stale results and weather/elevation failure states. Adapter tests do not run neural-network weights or prove model accuracy. No tests send production Firebase writes.

## Remaining work

- Real model benchmark on independent labelled photos; purpose-built dense-crowd model evaluation if general object detectors remain insufficient.
- Trained and independently evaluated regional hazard model using appropriate event labels and environmental covariates. Weather observations cannot substitute for that model.
- Qualified clinical/language review and approved protocols before clinical triage is added.
- Production Firebase rules/auth testing, GPS-write controls, expiring sharing links, retention policies and security review.
- Fully durable offline app loading and background delivery. Current local restoration is limited manual recovery.

Run with `npm test` and `py -m http.server 8000` on Windows. Use fictional inputs and a separate Firebase test project. Browser/model smoke-test findings are recorded in the pull request; they do not validate accuracy or deployed integrations.

## Browser smoke test for this revision

Headless Chromium successfully loaded the actual RT-DETR quantized weights and performed inference through the photo-upload UI on the supplied illustrated screenshot. This was a loading/output smoke test, not an accuracy benchmark (the screenshot already contains old annotations). The weather page retrieved actual Open-Meteo weather/elevation data for Imphal. The medical page retained unknown priority and unavailable distance for the supplied fictional heatstroke-like narrative. Authentication and Firestore were mocked to avoid production data access; Gemini with a real key, actual webcam capture, and deployment remain unverified. Browser network requests were proxied through the test runner because direct browser egress was unavailable in the editing environment.

## Weather & river outlook revision

- Rebuilt the weather UI with readable typography, explicit location-choice buttons, an empty state, refresh action, separate weather/terrain/river sections and expandable source details. Dashboard now has a clear action linking to the outlook.
- Added optional seven-day Copernicus GloFAS river-discharge retrieval through Open-Meteo's free non-commercial endpoint. Uses the provider default model (documentation currently describes GloFAS v4); no unsupported model-selector parameter is sent. Dates, units, returned grid coordinates, retrieval time and missing values are retained. No river name, local flood threshold, danger colour or flood probability is invented.
- NASA LHASA is presented as an external model/map, not falsely described as running in this site.
- Added five tests for forecast validation, missing vs zero flow, stale requests, ambiguous place names and provider failure. All 28 regression/controller tests and 56 legacy simulation assertions pass.
- Actual browser check: selected Shillong from two search matches and loaded seven river forecast rows. Desktop and 390px screenshots reviewed; no horizontal overflow. Auth was mocked and provider requests passed through the runner's network proxy, as in the previous browser check. No production Firebase writes or deployment changes.

## Gemini diagnostics and readable incident form

Saving a key previously only stored it, while all generation failures displayed one generic message. Settings now offer a small generation connection test (no incident text), editable model ID, inline storage status and specific key/access/quota/model/network/timeout errors. Raw provider errors and keys are not displayed or logged. The generation timeout is 30 seconds. A saved key or a successful test is not a clinical assessment. User-specific Google credentials/account access cannot be verified without the user's local test.

The medical page explicitly uses a light theme, white input backgrounds, contrasting buttons/status badges, stacked observation labels and a shorter consciousness option without a P1 priority claim. Hospital integration is deferred; request recording still never contacts a responder.

Suggested presentation wording: “Current prototype: incident recording and optional AI draft summaries. Future scope: verified hospital partnerships, authenticated responder dashboard, acknowledgement and two-way status updates. No hospital or ambulance dispatch is connected today.”

Future reply flow: user submits a request; an authorized partner reviews it; that partner explicitly acknowledges or replies; the backend stores the reply under the same request ID; the user's request-status screen displays it. Notifications and real dispatch require separate implementation and partner agreement. No acknowledgement or ETA should be simulated as real.

Validation for this revision: 56 legacy assertions and 32 regression/controller tests pass. Headless Chromium verified the settings dialog at desktop and 390px, white input background/dark text, and an intercepted HTTP 429 displayed the correct actionable message. Firebase and Gemini responses were mocked in this UI test; no real key, patient data or hospital contact was used.

## Model selection after HTTP 404

Gemini settings now load model IDs from Google's paginated models endpoint using the locally entered key, filter for generateContent support, and require explicit selection. The picker does not invent a replacement model or save one automatically. An edited key invalidates pending list results. Listing is not proof of generation access, free quota, or summary compatibility: users must still test generation. The model ID field has explicit visible borders and the safety stylesheet URL is versioned to refresh stale cached styling. All 34 regression/controller tests and 56 legacy assertions pass; provider responses in these new tests are mocked.

## Photo review and location-specific NASA lookup
- Added numbered AI markers and tap-to-add/remove corrections, undo, reset and explicit finish review. Original AI count remains separate. Edits, rescan, model change and new photos invalidate the review. Corrections are page-local and do not imply measured accuracy or venue totals.
- Added NASA LHASA Today ImageServer point lookup. NoData stays unknown; errors remain unavailable; location changes discard stale replies. The public service metadata does not expose a forecast timestamp, so numerical outputs are explicitly date-unverified, with no safety classification or local probability claim.
- Verified service metadata and a real Shillong point response (NoData). Browser rendering tests use synthetic images and mock detector outputs; no accuracy claim.
