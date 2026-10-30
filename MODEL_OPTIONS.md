# Disaster models: what can ExploreGuard use?

## Implemented: published river-flow forecasts

The weather page now retrieves seven days of daily river discharge from Copernicus GloFAS via Open-Meteo. GloFAS is a hydrological forecast system, not a small pretrained image or language model. Its published output can be used without training a new model or running the global computation on this static site.

The returned quantity is water flow in cubic metres per second. It is **not** a flood probability, inundation depth, flash-flood alert or declaration that a road is safe. The API's roughly 5 km grid may select a different river from the intended one. The page therefore exposes the returned grid location and does not invent a river name or warning threshold. Forecast dates are UTC; retrieval time is not forecast issue time. Missing or failed forecasts remain unavailable.

The API uses its default model; its current documentation describes GloFAS v4. A tested explicit `glofas_v4_forecast` selector was rejected by the live endpoint, so this integration does not send it. The response does not identify an issue timestamp or model version, and the interface does not manufacture either.

Open-Meteo's free access is non-commercial and rate-limited, with no uptime guarantee. This fits a small educational prototype within those limits; it is not a promise of unlimited free production service.

Sources:
- https://open-meteo.com/en/docs/flood-api
- https://open-meteo.com/en/pricing
- https://ewds.climate.copernicus.eu/datasets/cems-glofas-forecast?tab=overview

## Available open ML system: NASA LHASA

NASA LHASA estimates rainfall-triggered landslide hazard. NASA's version 2 uses machine learning (XGBoost); its repository provides an inference workflow for global hazard estimates. It requires a Python/geospatial environment, large static input datasets and dynamic satellite/environmental data. Its inputs are substantially richer than the two fields of rain and local slope previously used by this project.

The website currently links to NASA's map. It does **not** run LHASA or return a NASA probability for a selected location.

A realistic integration path is a small backend that retrieves published timestamped NASA raster outputs, samples the requested coordinates, checks missing values/coverage and records provenance. If published outputs are too stale or unavailable, show that state. Running the full pipeline yourself would additionally require the relevant Earthdata access, input downloads, compute/storage and scheduled processing. NASA describes published data as best-effort with downtime; production availability must be assessed separately.

Evaluate any output against regional events before presenting local warnings. Global grid estimates do not substitute for inspection of an individual slope or an official evacuation decision.

Sources:
- https://github.com/nasa/LHASA
- https://software.nasa.gov/software/GSC-18595-1
- https://landslides.nasa.gov/viewer

## What not to substitute

Do not ask a general language model to invent a disaster probability from a city name. Do not convert river discharge into a danger percentage without suitable local thresholds and validation. Additional data integration is real functionality; a confident label alone is not.
