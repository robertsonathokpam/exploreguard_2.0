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

`npm test` includes 56 **legacy simulation assertions** and 23 regression/controller tests. Legacy assertions exercise old formulas, which the active pages no longer import. They are not a forecast, language or clinical validation report.

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
