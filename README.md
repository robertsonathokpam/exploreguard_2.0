# ExploreGuard 2.0

**Weather and terrain information, assisted photo counting, and clearer incident reports in one student-built web prototype.**

ExploreGuard brings together information that citizens and volunteers may need during large gatherings such as Kumbh Mela and in mountain communities such as Manipur. A user can look up a location, review people detected in a photo, and prepare an incident report.

The goal is to support preparedness and human review. The prototype does not issue verified local disaster warnings, diagnose patients, or dispatch hospitals or ambulances.

## What works today

| Feature | What you can do | How to understand the result |
| --- | --- | --- |
| Weather and terrain | Search for a place or use device location; retrieve Open-Meteo weather, elevation and surrounding slope. | Provider model/grid values, not readings from a sensor at your exact site. Coarse slope is not a road-cut slope. |
| River outlook | Retrieve a seven-day river-discharge forecast through Open-Meteo/GloFAS. | Discharge is water flow in m³/s, not a flood probability or a safety classification. |
| NASA landslide lookup | Check NASA's LHASA grid at the selected coordinates. | Returned numbers are raw model output. The lookup does not establish the forecast timestamp. Missing data means unknown, not low risk. |
| Photo analysis | Detect visible people with RT-DETR or MobileNet V2, then add/remove markers and finish a manual review. | AI and reviewed counts are separate. Neither is a venue total. Dense or partly hidden crowds can be missed. |
| Location sharing | Share device coordinates through a Firebase-backed location page. | Requires permission, connectivity and appropriate database rules. It does not alert a responder. |
| Incident reporting | Enter a fictional report and observations; optionally generate a Gemini summary and record a demo request. | A summary is a draft. Database storage is not hospital acknowledgement or dispatch. |

Sign-in, a dashboard and a basic booking-record flow are also included. A saved booking does not establish an external reservation or emergency-service arrangement.

### Why photo analysis and location sharing are useful

Photo analysis gives a volunteer a starting point for reviewing **people visible in one image**. Manual corrections help catch missed people or incorrect markers. Location sharing supplies context about where a person is. These features can support a future volunteer workflow; they do not currently combine into automated crowd management.

Crowd density is people divided by the **measured ground area containing those people**. Image dimensions are not ground area. A useful estimate needs camera calibration, a matching count and validation. It is possible future work; dividing detections by an arbitrary area would be misleading. Crowd flow needs observations over time, and safe routes need verified site information.

## Run locally

You need Git to clone the repository, Python 3 to serve the website, and a modern browser. Node.js 20 or newer is a suitable baseline for tests. Internet access is needed for external libraries, model downloads, Firebase and data providers.

### 1. Get the code

```sh
git clone https://github.com/robertsonathokpam/exploreguard_2.0.git
cd exploreguard_2.0
```

Already have a copy? Check `git remote -v`: the current repository is **exploreguard_2.0**, not the older **exploreguard** repository. Commit or back up local edits before updating.

### 2. Configure Firebase for an independent setup

The app uses Firebase Authentication for sign-in and Cloud Firestore for storage.

1. Create your own Firebase test project and register a web app.
2. Replace the `firebaseConfig` values in [firebase-config.js](firebase-config.js) with your project's web configuration.
3. Enable Email/Password sign-in and create a Firestore database.
4. Configure authorized sign-in domains for your local and hosted environments.
5. Set and test database rules for the intended users and collections. Do not make the database publicly writable to bypass an error.

Collections used include `users`, `bookings`, `locations`, `triages` and `emergency_dispatches`. The last two names are inherited: their current records are **demo incident records**, not clinical assessments or real dispatch jobs. Production access-control validation remains future work.

Some pages reference an optional local `config.js`. Create it in the project root to avoid a missing-file request:

```js
window.CONFIG = {};
```

This file is ignored by Git. The old `config.example.js` contains an OpenWeather placeholder; the current weather page uses Open-Meteo and does not need that key. Configure Gemini through its settings screen below.

### 3. Start the website

Windows:

```sh
py -m http.server 8000
```

macOS/Linux:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000**, create a test account or sign in, and open the dashboard. Keep the terminal running. Do not open HTML files directly with a `file://` URL: the app uses JavaScript modules and network requests.

There is no frontend build step, and the current `package.json` does not require npm dependency installation. Python serves the files; Node runs tests. A hosted version needs HTTPS for camera/location features and a working Firebase configuration. Hosting files alone does not configure those integrations.

### 4. Optional: connect Gemini summaries

1. Open the incident-report page and **Gemini summary settings**.
2. Enter your own Google Gemini API key.
3. Choose **Load available models**, then select a returned generation model.
4. Choose **Test connection**. This sends a short test prompt, not your incident report.
5. After a successful test, choose **Save Key** to save the settings.
6. Enter a fictional report, explicitly request a summary, and review the result.

Saving a key alone does not test it. A listed model may still have access or quota restrictions. A successful connection test confirms that generation worked, not medical accuracy.

## Demo walkthrough

Use fictional incident information and photos you have permission to use.

1. **Weather:** search for a city, choose the matching location, and read the weather values and source details. Load the river forecast and check NASA data separately. Show unavailable data as unavailable.
2. **Photo review:** upload a photo, select a detector and run the scan. Inspect the numbered markers. Click/tap a missed person to add a marker or an existing marker to remove it. Use Undo or Reset if needed, then Finish review. Corrections stay on this page and clear when the photo/model changes or a new scan runs.
3. **Incident report:** enter a fictional description and known observations, leaving unknown values unknown. Generate an optional summary. Recording a demo request may include device location if permission is granted; confirmation only confirms database storage.
4. **Location sharing, if needed:** enable sharing with permission, check the link in a test session, then turn sharing off. Treat the link and coordinates as private information.

## How the project works

The interface uses **HTML, CSS and browser JavaScript**. There is no custom application server in this repository: the browser calls Firebase and external services directly.

| User action | Processing | Result |
| --- | --- | --- |
| Select a location | Browser requests Open-Meteo data; optional river and NASA requests run separately. | Values with units, source details and availability information. |
| Scan a photo | Browser loads RT-DETR through Transformers.js/ONNX or COCO-SSD MobileNet V2 through TensorFlow.js. | Person markers and count, followed by optional human corrections. |
| Request an AI summary | Browser sends the entered report/observations to Gemini. | Draft summary or an explicit generation error. |
| Record a demo request | Browser attempts a Firebase write with a stable request ID. | Confirmed storage, pending confirmation or failure. |

For incident recording, a local pending copy is attempted before the database write and cleared after acknowledgement. A restore action supports limited manual recovery. This is not a complete offline app or guaranteed background delivery.

## What the tests mean

Run from the repository root in a separate terminal:

```sh
npm test
```

The current suite contains **37 regression/controller tests and 56 legacy calculation assertions**.

- **Regression/controller tests** check software behaviour: missing values, failed services, outdated responses, model-output handling, photo corrections, Gemini settings and request-storage states. External services and browser elements are often replaced with controlled test doubles.
- **Legacy calculation assertions** check earlier simulation formulas in `js/risk-engine.js`. The active dashboard, weather, photo and incident pages do not use that engine. Its old risk/triage examples are not live features.

**Passing tests means the checked code paths behave as expected. It does not mean accurate crowd counts, verified landslide predictions, clinical validity or working hospital dispatch.** Adapter tests do not measure neural-network accuracy on real crowds.

To measure counting quality, evaluate independent, manually labelled photos covering sparse, dense, hidden and empty scenes. Report count error and detection precision/recall separately from human-corrected results.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Old interface after updating | Confirm the repository/branch, then hard-refresh. Check the deployed revision separately. |
| Sign-in fails or returns to login | Firebase configuration, enabled sign-in method, authorized domain and connectivity. |
| Database request fails or stays pending | Authentication, Firestore rules and network access. Pending is not confirmed delivery. |
| Gemini model unavailable / HTTP 404 | Load available models, select one, test generation, then save. Do not rely on an old model name. |
| Gemini key/access/quota error | Follow the displayed error and check project access/quota. Saving the key again does not resolve a quota limit. |
| Photo scan is slow or fails | First use downloads model files. Check connectivity/device resources; try the selectable lighter MobileNet V2 detector if needed. |
| Too few people detected | Check small distant people, image quality and occlusion. Review markers manually; do not apply a count multiplier. |
| NASA has no usable value | No usable source value or request failure. It is not evidence of low risk. |
| Camera/location unavailable | Check device/browser permissions; use localhost or HTTPS. |
| Missing `config.js` | Create the optional empty configuration shown above. Never commit a personal Gemini key. |

## Privacy, costs and deployment limits

- Photo detection runs in the browser; the current detection flow does not upload the photo to a model server. Model files and libraries still require downloads.
- Explicit Gemini summarization sends report content to Google. Use fictional cases. The key is stored in browser local storage, accessible to scripts on the site; use a trusted device and clear it after a shared-device demo.
- Recording a request sends its report and available location to Firebase. Location sharing also writes coordinates. Rules, sharing access, retention and deletion need production security review.
- No hospital receives or acknowledges requests through this prototype. A partner dashboard, authenticated replies and status updates must be built before that claim can be made.
- Free-tier services may support a small demo, but provider quotas, hosting limits and model downloads apply. Unlimited zero-cost production use is not promised.
- Full offline loading, reliable background synchronization and production monitoring are not implemented.

## Project structure

| File or folder | Purpose |
| --- | --- |
| `index.html`, `login.html`, `dashboard.html` | Landing page, account access and feature navigation. |
| `alerts.html`, `js/alerts.js` | Weather, terrain, river forecast and NASA lookup. |
| `js/environment-data.js` | Provider-data parsing and validation. |
| `tracker.html`, `js/tracker.js` | Location sharing, photo scanning and marker review. |
| `js/vision-model.js` | Detector loading and output adaptation. |
| `safety.html`, `js/safety.js` | Incident form, Gemini settings/summary and demo storage. |
| `booking.html`, `js/booking.js` | Basic booking-record flow. |
| `view-location.html`, `js/view-location.js` | Shared-location viewer. |
| `firebase-config.js` | Firebase initialization. |
| `css/` | Page styling. |
| `tests/` | Regression/controller tests and historical calculation checks. |
| `sample_data/` | Synthetic legacy test inputs, not live telemetry. |
| `js/risk-engine.js` | Historical simulation engine disconnected from active feature pages. |
| [FIXES.md](FIXES.md) | Change and verification history; earlier sections describe earlier revisions. |
| [MODEL_OPTIONS.md](MODEL_OPTIONS.md) | Model/data research notes and limitations. |

## Next development steps

1. **Measure photo-count quality:** compare detectors on labelled real images before claiming improved accuracy.
2. **Evaluate crowd density:** define a camera view and measured ground area, calibrate perspective and validate counts for that area.
3. **Improve landslide information:** investigate source coverage/timestamps and evaluate suitability against local events. Global models can be explored; reliable local warnings need local evaluation and appropriate environmental data.
4. **Connect verified responders:** agree a partner workflow, build an authenticated dashboard, and link acknowledgements/replies to the original request ID. Add notifications after that flow works.
5. **Harden the application:** test Firebase rules, protect credentials appropriately, restrict/expire location sharing and define retention/deletion policies.
6. **Improve resilience:** implement and test offline loading, retry behaviour, deployment monitoring and accessibility.

These are planned improvements, not completed features. Clinical assessment or triage would additionally require qualified review and validation.

## License and further reading

Project code uses the [MIT License](LICENSE). External models, libraries and data providers have their own licenses and terms.

- [RT-DETR browser model](https://huggingface.co/onnx-community/rtdetr_r18vd)
- [TensorFlow.js COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd)
- [Open-Meteo weather documentation](https://open-meteo.com/en/docs)
- [Open-Meteo flood documentation](https://open-meteo.com/en/docs/flood-api)
- [NASA LHASA service used by this prototype](https://gis.earthdata.nasa.gov/portal/rest/services/Landslides/LHASA_Hazard_Today/ImageServer)

Built by the ExploreGuard team for disaster mitigation, large-gathering safety and clearer emergency reporting.
