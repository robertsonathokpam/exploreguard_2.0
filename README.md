# ExploreGuard 2.0

A student prototype exploring disaster information, photo person detection and incident reporting. It is not a validated disaster forecasting, crowd safety or clinical triage system.

## Current pages

- **Weather & river outlook (`alerts.html`)**: location search offers matching places before retrieval. Shows Open-Meteo conditions and terrain plus an optional seven-day Copernicus GloFAS river-discharge forecast. Published forecasts are retrieved, not trained in the browser. Units, UTC forecast dates, returned grid coordinates and source details are shown. River flow is not a flood probability. NASA LHASA is linked as an external map, not claimed as an integrated local forecast. See [MODEL_OPTIONS.md](MODEL_OPTIONS.md).
- **Photo detection (`tracker.html`)**: offers RT-DETR R18 via Transformers.js (quantized ONNX/WASM) and full COCO-SSD MobileNet V2 via TensorFlow.js. Images are processed in the browser. Only model-returned person boxes are counted. No sample sectors, synthetic detections, count multiplier or automatic crowd-density estimate is used. Dense/occluded crowds and illustrations can be miscounted. Actual accuracy has not been benchmarked.
- **Incident reporting (`safety.html`)**: records the entered fictional report and observations. Unknown vitals remain unknown. Optional Gemini draft summarization runs only when explicitly requested. No local keyword diagnosis, coloured medical priority, treatment, facility assignment, distance or ETA is produced. Requests stored in Firestore are demo records, not responder dispatches.
- Existing authentication, booking and GPS sharing remain prototypes and require their own integration/security review.

## Run locally

Requires Node.js for tests and Python for the local web server:

```sh
npm test
python -m http.server 8000
```

On Windows use `py -m http.server 8000`. Open http://localhost:8000. Use a separate Firebase test project for sign-in and database testing, with appropriate authorized domains and security rules. The existing `firebase-config.js` is not evidence that deployed rules are safe.

No build step is required. External styles, Firebase SDKs and model files require internet access. Model downloads/inference consume the user's bandwidth and device resources. Weather-provider limits and Gemini quotas/pricing apply; unlimited zero-cost production hosting or APIs are not promised. The optional Gemini key is stored in browser local storage and should only be used on a trusted device with fictional input.

## Validation and limitations

See [FIXES.md](FIXES.md). The old `js/risk-engine.js` and its 56 legacy calculation assertions remain for historical simulation experiments; the live dashboard, weather, photo and incident pages no longer import that engine. Those tests do not establish predictive or clinical accuracy.

To evaluate counting, assemble consented real photos with independently labelled person counts, record model/threshold, compare detections against annotations, and report count error plus detection precision/recall. Include sparse, dense, occluded and empty scenes. Do not tune on the same images used for final evaluation.

## Model/data references

- RT-DETR browser model: https://huggingface.co/onnx-community/rtdetr_r18vd
- TensorFlow COCO-SSD options: https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd
- Open-Meteo weather and elevation documentation: https://open-meteo.com/en/docs

Clinical triage, locally validated warning thresholds, integrated LHASA outputs, real responder integration, safe routing and full offline delivery remain future work.
