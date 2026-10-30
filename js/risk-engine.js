// Inputs must fail explicitly rather than produce NaN with a reassuring risk label.
function finiteInput(value, name, min = -Infinity, max = Infinity) {
  if (value === null || value === '' || typeof value === 'boolean' || !Number.isFinite(Number(value))
      || Number(value) < min || Number(value) > max) throw new RangeError(`Invalid ${name}`);
  return Number(value);
}

/**
 * ExploreGuard AI Disaster Risk & Triage Engine 2.0
 * Hack for Social Cause (VBYLD 2027)
 * Theme: Disaster Mitigation, Kumbh Mela & Health Service Delivery
 * 
 * Includes:
 * 1. Multivariate Logistic Regression (Sigmoid) Hazard Engine
 * 2. Dynamic 5-Point Topographic DEM Gradient & Slope Estimation
 * 3. Multi-Venue Pedestrian Dynamics & Fruin Level of Service (LoS)
 * 4. Multilingual Clinical NLP Triage Classifier (English, Hindi, Manipuri)
 */

// Sigmoid mathematical activation
export function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

// Regional Benchmark Terrain Profiles (Preserved for 1-Click Demos)
export const TERRAIN_PROFILES = {
  'nh-37': {
    id: 'nh-37',
    name: 'Manipur NH-37 (Imphal - Jiribam Landslide Corridor)',
    category: 'High-Altitude Cut Slopes',
    slopeWeight: 0.90,       // Steep gradient (38° - 55°)
    soilFragility: 0.88,     // Disintegrated shale, porous sedimentary rock
    historyWeight: 0.95,     // Historical epicenter of major monsoon mudslides
    floodVulnerability: 0.45,
    safeShelters: ['Noney Higher Secondary Evacuation Centre', 'Tamenglong Transit Camp #2'],
    highRiskZones: ['Awangkhul Cut-bank', 'Tupul Valley Bypass']
  },
  'nh-2': {
    id: 'nh-2',
    name: 'Manipur NH-2 (Imphal - Kohima Montane Pass)',
    category: 'Mountain Ridge Subsidence',
    slopeWeight: 0.78,       // Slope gradient (25° - 40°)
    soilFragility: 0.72,     // Weathered clay and loose scree
    historyWeight: 0.80,     // Annual roadblock due to debris flows
    floodVulnerability: 0.35,
    safeShelters: ['Kangpokpi Youth Hall', 'Senapati District Sports Complex'],
    highRiskZones: ['Koubru Foothills Pass', 'Mao Border S-Curves']
  },
  'imphal-valley': {
    id: 'imphal-valley',
    name: 'Imphal Valley Flood Plains (Thoubal & Bishnupur)',
    category: 'Alluvial River Basin',
    slopeWeight: 0.18,       // Low gradient (flat alluvial plain)
    soilFragility: 0.55,     // High silt retention, poor drainage percolation
    historyWeight: 0.75,     // Recurring Loktak / Imphal / Nambul river overflows
    floodVulnerability: 0.95,// Extreme flash-flood susceptibility
    safeShelters: ['Khuman Lampak Stadium High Grounds', 'Bishnupur Multi-Purpose Hall'],
    highRiskZones: ['Lilong River Embankment', 'Keibul Lamjao Buffer Zone']
  },
  'churachandpur': {
    id: 'churachandpur',
    name: 'Churachandpur Hill Ranges & Khuga Basin',
    category: 'Montane Watershed',
    slopeWeight: 0.68,
    soilFragility: 0.65,
    historyWeight: 0.62,
    floodVulnerability: 0.55,
    safeShelters: ['District Hospital Highland Pavilion', 'Tuibong Community Hall'],
    highRiskZones: ['Khuga Dam Spillway Reach', 'Lanva River Bend']
  },
  'kumbh-sangam': {
    id: 'kumbh-sangam',
    name: 'Kumbh Mela Sangam Riverbank & Lowland Ghats',
    category: 'River Confluence Plain',
    slopeWeight: 0.12,
    soilFragility: 0.40,
    historyWeight: 0.35,
    floodVulnerability: 0.88,
    safeShelters: ['Sector 4 High Ground Transit Center', 'Parade Ground Elevated Shelter'],
    highRiskZones: ['Sangam Nose Ghat', 'Pontoon Bridge #3 Embankment']
  }
};

/**
 * Calculates topographic gradient and slope angle (degrees) from a 5-point DEM elevation grid.
 * Offsets: Center (lat, lon), North (+offset), South (-offset), East (+offset), West (-offset)
 * @param {number} centerElev - Center point elevation (m)
 * @param {number} northElev - North offset elevation (m)
 * @param {number} southElev - South offset elevation (m)
 * @param {number} eastElev - East offset elevation (m)
 * @param {number} westElev - West offset elevation (m)
 * @param {number} offsetDeg - Angular offset in degrees (default 0.005 ~= 556m)
 * @returns {Object} { slopeAngleDeg, slopeFactor, deltaNS, deltaEW, avgElev }
 */
export function estimateSlopeFromElevationGrid(centerElev, northElev, southElev, eastElev, westElev, offsetDeg = 0.005, latitude = 0) {
  [centerElev, northElev, southElev, eastElev, westElev].forEach(v => finiteInput(v, 'elevation'));
  finiteInput(offsetDeg, 'elevation offset', 0.000001, 1);
  finiteInput(latitude, 'latitude', -89.9, 89.9);
  const dMeters = offsetDeg * 2 * 111320; // ~1113.2 meters across
  const deltaNS = Math.abs(Number(northElev) - Number(southElev));
  const deltaEW = Math.abs(Number(eastElev) - Number(westElev));
  const rise = Math.sqrt(deltaNS * deltaNS + deltaEW * deltaEW);
  const gradient = Math.hypot(deltaNS / dMeters, deltaEW / (dMeters * Math.cos(latitude * Math.PI / 180)));
  const slopeAngleDeg = Math.round(Math.atan(gradient) * (180 / Math.PI) * 10) / 10;
  // Normalized slope factor between 0.05 and 1.0 (45 degrees or more = 1.0)
  const slopeFactor = Math.max(0.05, Math.min(1.0, slopeAngleDeg / 45));
  const avgElev = Math.round((Number(centerElev) + Number(northElev) + Number(southElev) + Number(eastElev) + Number(westElev)) / 5);

  return {
    slopeAngleDeg,
    slopeFactor,
    deltaNS: Math.round(deltaNS),
    deltaEW: Math.round(deltaEW),
    avgElevationMeters: avgElev
  };
}

/**
 * Computes AI Multi-Hazard Risk, Landslide & Flash-Flood Probabilities
 * Uses a Multivariate Logistic Regression Model with Sigmoid Activation: P = 1 / (1 + e^-z)
 * Supports both predefined regional corridors and dynamic worldwide locations with real DEM elevation.
 * 
 * @param {Object} weather - Telemetry data { rainfall, humidity, windSpeed, pressure }
 * @param {string|Object} terrainOrCustom - Corridor ID (e.g. 'nh-37') OR custom terrain object
 * @param {Object} dynamicElevation - Optional { slopeAngleDeg, slopeFactor, avgElevationMeters }
 * @returns {Object} Comprehensive hazard assessment
 */
export function computeDisasterRisk(weather = {}, terrainOrCustom = 'nh-37', dynamicElevation = null) {
  let terrain;
  if (typeof terrainOrCustom === 'object' && terrainOrCustom !== null) {
    terrain = {
      id: terrainOrCustom.id || 'custom-location',
      name: terrainOrCustom.name || 'Universal Coordinate Sector',
      category: terrainOrCustom.category || 'Dynamic Topographic Zone',
      slopeWeight: dynamicElevation?.slopeFactor ?? terrainOrCustom.slopeWeight ?? 0.5,
      soilFragility: terrainOrCustom.soilFragility ?? 0.70,
      historyWeight: terrainOrCustom.historyWeight ?? 0.80,
      floodVulnerability: terrainOrCustom.floodVulnerability ?? 0.50,
      safeShelters: terrainOrCustom.safeShelters || [],
      highRiskZones: terrainOrCustom.highRiskZones || ['Unstable Low-lying Slopes', 'River Confluence Culverts']
    };
  } else {
    terrain = TERRAIN_PROFILES[terrainOrCustom] || TERRAIN_PROFILES['nh-37'];
    if (dynamicElevation?.slopeFactor !== undefined) {
      terrain = { ...terrain, slopeWeight: dynamicElevation.slopeFactor };
    }
  }

  const rainfall = Number(weather.rainfall ?? 0);     // mm/hr
  const humidity = Number(weather.humidity ?? 60);    // %
  const windSpeed = Number(weather.windSpeed ?? 15);  // km/h
  const pressure = Number(weather.pressure ?? 1013);  // hPa

  finiteInput(weather.rainfall ?? 0, 'rainfall', 0, 2000);
  finiteInput(weather.humidity ?? 60, 'humidity', 0, 100);
  finiteInput(weather.windSpeed ?? 15, 'wind speed', 0, 1000);
  finiteInput(weather.pressure ?? 1013, 'pressure', 100, 1200);
  ['slopeWeight', 'soilFragility', 'historyWeight', 'floodVulnerability'].forEach(key => finiteInput(terrain[key], key, 0, 1));
  // 1. Normalized Weather Indices
  // Rainfall index: 0 mm -> 0, 25 mm/h -> 1.0, 60+ mm/h -> up to 2.5 (cloudburst)
  const rainNorm = Math.min(2.5, rainfall / 25);
  // Humidity Index (saturated air >= 85% accelerates soil liquefaction)
  const humidityNorm = Math.max(0, Math.min(1.0, (humidity - 40) / 60));
  // Barometric Depression Index (pressure < 1013 hPa signals cyclone/monsoon depression)
  const pressureNorm = pressure < 1013 ? Math.min(1.5, (1013 - pressure) / 15) : 0;
  // Wind shear contribution
  const windNorm = Math.min(1.0, windSpeed / 70);

  // 2. Topographic & Geomorphological Indices
  const slopeNorm = Math.max(0.05, Math.min(1.0, terrain.slopeWeight));
  const soilFragilityNorm = terrain.soilFragility * terrain.historyWeight;
  const floodPlainNorm = terrain.floodVulnerability;

  // 3. Multivariate Logistic Regression: Landslide Probability
  // z_ls = beta_0 + beta_rain*R + beta_slope*S + beta_hum*H + beta_press*B + beta_soil*F + beta_wind*W
  const zLandslide = -2.6 +
    (2.4 * rainNorm) +
    (1.9 * slopeNorm) +
    (0.7 * humidityNorm) +
    (0.5 * pressureNorm) +
    (0.8 * soilFragilityNorm) +
    (0.3 * windNorm);

  const landslideProb = Math.max(5, Math.min(99, Math.round(sigmoid(zLandslide) * 100)));

  // 4. Multivariate Logistic Regression: Flash-Flood Probability
  // High slope sheds water quickly (negative slope weight for flood plain ponding)
  const zFlood = -2.5 +
    (2.6 * rainNorm) +
    (2.2 * floodPlainNorm) +
    (0.7 * humidityNorm) +
    (0.5 * pressureNorm) -
    (1.1 * slopeNorm);

  const floodProb = Math.max(4, Math.min(99, Math.round(sigmoid(zFlood) * 100)));

  // 5. Composite Multi-Hazard Score
  const dominantProb = Math.max(landslideProb, floodProb);
  const secondaryProb = Math.min(landslideProb, floodProb);
  const compositeScore = Math.round(dominantProb * 0.75 + secondaryProb * 0.25);

  // 6. Risk Tier & Badge
  let riskLevel = 'Low';
  let badgeClass = 'badge-success';
  let color = '#10b981'; // Green
  let summary = 'Terrain stability within normal safety thresholds. Routine transit permitted.';

  if (compositeScore >= 70) {
    riskLevel = 'Critical';
    badgeClass = 'badge-error';
    color = '#ef4444'; // Red
    summary = 'Severe immediate hazard: Torrential saturation and geomorphological stress detected.';
  } else if (compositeScore >= 40) {
    riskLevel = 'Moderate';
    badgeClass = 'badge-warning';
    color = '#f59e0b'; // Amber
    summary = 'Elevated hazard: Increased slope saturation and drainage stress observed.';
  }

  // 7. Actionable Recommended Evacuation Protocol
  const isFloodDominant = floodProb > landslideProb || (floodProb === landslideProb && terrain.floodVulnerability > terrain.slopeWeight);
  let evacuationAction = '';
  if (riskLevel === 'Critical') {
    if (!isFloodDominant) {
      evacuationAction = `HALT TRANSIT IMMEDIATELY along ${terrain.name}. Debris flow risk high at ${terrain.highRiskZones.join(' & ')}. Evacuate downhill vehicles to designated shelter: ${terrain.safeShelters[0]}.`;
    } else {
      evacuationAction = `FLASH-FLOOD WARNING for ${terrain.name}. Inundation rapid. Move all personnel & vehicles to high ground shelters at ${terrain.safeShelters[0]}. Avoid culverts and riverbanks.`;
    }
  } else if (riskLevel === 'Moderate') {
    if (!isFloodDominant) {
      evacuationAction = `Exercise high transit caution along ${terrain.name}. Maintain minimum 100m inter-vehicle spacing. Avoid stopping under active cut-slopes. Check emergency radio.`;
    } else {
      evacuationAction = `Drainage surcharge expected in low-lying sectors of ${terrain.name}. Relocate sensitive equipment above ground floor. Avoid low causeways.`;
    }
  } else {
    evacuationAction = `Conditions normal along ${terrain.name}. Maintain standard speed limits and monitor periodic district weather bulletins.`;
  }

  return {
    terrainId: terrain.id,
    terrainName: terrain.name,
    category: terrain.category,
    landslideProbability: landslideProb,
    floodProbability: floodProb,
    compositeScore,
    riskLevel,
    badgeClass,
    color,
    summary,
    evacuationAction,
    metrics: {
      rainfallMmH: rainfall,
      humidityPercent: humidity,
      windSpeedKmh: windSpeed,
      pressureHpa: pressure,
      slopeCoefficient: Math.round(terrain.slopeWeight * 100),
      soilFragilityIndex: Math.round(terrain.soilFragility * 100),
      floodPlainIndex: Math.round(terrain.floodVulnerability * 100),
      slopeAngleDeg: dynamicElevation?.slopeAngleDeg ?? Math.round(terrain.slopeWeight * 45),
      avgElevationMeters: dynamicElevation?.avgElevationMeters ?? 750
    },
    safeShelters: terrain.safeShelters,
    highRiskZones: terrain.highRiskZones,
    timestamp: new Date().toISOString()
  };
}

// -------------------------------------------------------------
// MASS-GATHERING & KUMBH CROWD TELEMETRY (MULTI-VENUE ENGINE)
// -------------------------------------------------------------

export const CROWD_VENUES = {
  'kumbh-mela': {
    id: 'kumbh-mela',
    name: 'Prayagraj Kumbh Mela (National Benchmark)',
    city: 'Prayagraj, Uttar Pradesh',
    sectors: {
      'sector-a': {
        id: 'sector-a',
        name: 'Sector A: Sangam Holy Bathing Ghat',
        location: 'Triveni Sangam Riverbank Confluence',
        areaSqM: 6000,
        safeCapacity: 12000,
        designMaxDensity: 2.0,
        evacuationRoutes: ['Eastern High Bund Pathway', 'Ghat Exit Escalier #2', 'Ambulance Pier 1'],
        currentCount: 13800,
        inflowPerMin: 420,
        outflowPerMin: 390
      },
      'sector-b': {
        id: 'sector-b',
        name: 'Sector B: Transit Hub & Pontoon Bridges',
        location: 'Central Rail/Bus Intermodal & Bridges 1-4',
        areaSqM: 7500,
        safeCapacity: 18750,
        designMaxDensity: 2.5,
        evacuationRoutes: ['Pontoon Bridge 2 One-Way Spillway', 'North Ring Corridor', 'Rail Shuttle Bay C'],
        currentCount: 36000,
        inflowPerMin: 890,
        outflowPerMin: 410
      },
      'sector-c': {
        id: 'sector-c',
        name: 'Relief Camp Zone & Community Kitchen',
        location: 'Sector 5 Shelter Grid & Langar Pavilion',
        areaSqM: 14000,
        safeCapacity: 28000,
        designMaxDensity: 2.0,
        evacuationRoutes: ['Grand Trunk Main Arterial', 'Sector 5 West Gate', 'Supply Depot Lane'],
        currentCount: 16500,
        inflowPerMin: 220,
        outflowPerMin: 210
      },
      'sector-d': {
        id: 'sector-d',
        name: 'Medical Emergency Corridor & Field PHC',
        location: 'Dedicated Red-Cross Emergency Artery',
        areaSqM: 4500,
        safeCapacity: 4500,
        designMaxDensity: 1.0,
        evacuationRoutes: ['Trauma Center Fast-Track', 'Helipad Access Artery', 'Civil Hospital Radial'],
        currentCount: 3600,
        inflowPerMin: 95,
        outflowPerMin: 110
      }
    }
  },
  'imphal-festival': {
    id: 'imphal-festival',
    name: 'Imphal Lai Haraoba & Yaoshang Festival (Manipur Regional)',
    city: 'Imphal, Manipur',
    sectors: {
      'sector-a': {
        id: 'sector-a',
        name: 'Kangla Fort Sacred Gathering Grounds',
        location: 'Kangla Sanathong Sacred Gate',
        areaSqM: 8000,
        safeCapacity: 16000,
        designMaxDensity: 2.0,
        evacuationRoutes: ['Kangla West Moat Gate', 'Nambul River Promenade', 'North Citadel Exit'],
        currentCount: 14200,
        inflowPerMin: 380,
        outflowPerMin: 360
      },
      'sector-b': {
        id: 'sector-b',
        name: 'Khwairamband Ima Market Transit Hub',
        location: 'Central Intermodal & Kanglapat Road Junction',
        areaSqM: 6500,
        safeCapacity: 13000,
        designMaxDensity: 2.0,
        evacuationRoutes: ['Bir Tikendrajit Road Arterial', 'Thangal Bazaar Spillway', 'BT Park Corridor'],
        currentCount: 19800,
        inflowPerMin: 720,
        outflowPerMin: 350
      },
      'sector-c': {
        id: 'sector-c',
        name: 'Hapta Kangjeibung Pavilion & Sports Arena',
        location: 'Palace Compound Cultural Arena',
        areaSqM: 15000,
        safeCapacity: 30000,
        designMaxDensity: 2.0,
        evacuationRoutes: ['Palace Compound Avenue', 'Sanjenthong Bridge Exit', 'Govt Press Bypass'],
        currentCount: 18000,
        inflowPerMin: 280,
        outflowPerMin: 270
      },
      'sector-d': {
        id: 'sector-d',
        name: 'RIMS & JNIMS Hospital Transit Corridor',
        location: 'Emergency Red Route to RIMS Trauma Bay',
        areaSqM: 4000,
        safeCapacity: 4000,
        designMaxDensity: 1.0,
        evacuationRoutes: ['Lamphelpat Dedicated Fast-Track', 'Uripok Road Arterial', 'JNIMS Access Pier'],
        currentCount: 2800,
        inflowPerMin: 90,
        outflowPerMin: 100
      }
    }
  }
};

// Aliased export for backwards compatibility with VBYLD tests
export const CROWD_SECTORS = CROWD_VENUES['kumbh-mela'].sectors;

/**
 * Computes Crowd Density, Stampede Hazard, Bottleneck Detection & Decongestion Routing
 * @param {string} sectorId
 * @param {number} customCountOverride - optional simulation count
 * @param {string|Object} venueOrCustom - Venue identifier or custom venue configuration
 * @returns {Object} Crowd telemetry & safety guidance
 */
export function computeCrowdRisk(sectorId = 'sector-a', customCountOverride = null, venueOrCustom = 'kumbh-mela') {
  let sector;
  if (typeof venueOrCustom === 'object' && venueOrCustom !== null && venueOrCustom.sectors) {
    sector = venueOrCustom.sectors[sectorId] || Object.values(venueOrCustom.sectors)[0];
  } else {
    const venue = CROWD_VENUES[venueOrCustom] || CROWD_VENUES['kumbh-mela'];
    sector = venue.sectors[sectorId] || CROWD_SECTORS[sectorId] || Object.values(venue.sectors)[0];
  }

  const count = customCountOverride !== null ? Number(customCountOverride) : sector.currentCount;
  finiteInput(customCountOverride !== null ? customCountOverride : sector.currentCount, 'headcount', 0, 100000000);
  finiteInput(sector.areaSqM, 'area', 0.000001);
  finiteInput(sector.inflowPerMin, 'inflow', 0);
  finiteInput(sector.outflowPerMin, 'outflow', 0);
  const density = +(count / sector.areaSqM).toFixed(2); // persons / m²
  const flowRatio = +(sector.inflowPerMin / Math.max(1, sector.outflowPerMin)).toFixed(2);

  let stampedeRisk = 'Safe';
  let badgeColor = '#10b981';
  let badgeClass = 'badge-success';
  let bottleneckTriggered = false;
  let decongestionRouting = '';

  if (density >= 4.0 || (density >= 3.2 && flowRatio > 1.8)) {
    stampedeRisk = 'Critical';
    badgeColor = '#ef4444';
    badgeClass = 'badge-error';
    bottleneckTriggered = true;
    decongestionRouting = `CRITICAL DECONGESTION ACTIVATED: Inflow exceeds egress by ${Math.max(0, (flowRatio - 1) * 100).toFixed(0)}%. Close barrier gates at inflow corridor. Divert oncoming pilgrim surge through ${sector.evacuationRoutes[0]} toward ${sector.evacuationRoutes[1]}. Dispatch Quick Reaction Force (QRF).`;
  } else if (density >= 2.2 || flowRatio > 1.3) {
    stampedeRisk = 'Moderate';
    badgeColor = '#f59e0b';
    badgeClass = 'badge-warning';
    bottleneckTriggered = flowRatio > 1.4;
    decongestionRouting = `Pacing controls required: Throttle entrance turnstiles. Deploy public address volunteers to keep pilgrim columns moving along ${sector.evacuationRoutes[0]}. Hold incoming surges at holding pens.`;
  } else {
    stampedeRisk = 'Safe';
    badgeColor = '#10b981';
    badgeClass = 'badge-success';
    bottleneckTriggered = false;
    decongestionRouting = `Flow rates optimal. All primary evacuation routes (${sector.evacuationRoutes.join(', ')}) remain fully clear and unobstructed.`;
  }

  return {
    sectorId: sector.id,
    sectorName: sector.name,
    location: sector.location,
    headcount: count,
    areaSqM: sector.areaSqM,
    densityPersonsPerSqM: density,
    flowRatio,
    inflowPerMin: sector.inflowPerMin,
    outflowPerMin: sector.outflowPerMin,
    stampedeRisk,
    badgeColor,
    badgeClass,
    bottleneckTriggered,
    decongestionRouting,
    evacuationRoutes: sector.evacuationRoutes,
    timestamp: new Date().toISOString()
  };
}

// -------------------------------------------------------------
// MULTILINGUAL CLINICAL NLP TRIAGE CLASSIFIER (START / MANCHESTER)
// -------------------------------------------------------------

export const TRIAGE_CATEGORIES = {
  'stampede-trauma': {
    id: 'stampede-trauma',
    title: 'Stampede Trauma / Crush Injury',
    icon: 'activity',
    keywords: ['crush', 'trampled', 'chest compression', 'suffocation', 'asphyxia', 'limb fracture', 'pelvic trauma', 'भगदड़', 'दब गया', 'दबे', 'thek-khre', 'thengnaba'],
    defaultPriority: 'RED',
    goldenHourMinutes: 20,
    phcType: 'Tertiary Trauma Center & Resuscitation Bay',
    firstAidSteps: [
      '1. Remove patient from crush zone immediately to an open, aerated area.',
      '2. Check Airway, Breathing, and Circulation (ABC). If unresponsive and pulseless, initiate immediate CPR (30 compressions : 2 rescue breaths).',
      '3. For traumatic chest compression (crush asphyxia): Keep torso elevated 30-45 degrees to relieve intra-thoracic pressure.',
      '4. Control active external arterial bleeding with direct continuous pressure; apply tourniquet if extremity hemorrhage is uncontrolled.',
      '5. Immobilize suspected cervical spine and fractured limbs using rigid splints or rolled clothing.'
    ]
  },
  'heatstroke-dehydration': {
    id: 'heatstroke-dehydration',
    title: 'Severe Dehydration / Heatstroke',
    icon: 'sun',
    keywords: ['heat', 'fainting', 'high fever', 'no sweat', 'delirium', 'confusion', 'dizziness', 'parched', 'hyperthermia', 'लू', 'गर्मी', 'धूप', 'चक्कर', 'sa-kanba', 'numit'],
    defaultPriority: 'YELLOW',
    goldenHourMinutes: 45,
    phcType: 'Rehydration & Heat Exhaustion Camp',
    firstAidSteps: [
      '1. Relocate patient immediately to full shade or an air-conditioned medical tent.',
      '2. Loosen all restrictive clothing; fan vigorously while spraying cool (not freezing) water over body.',
      '3. Apply cold packs or soaked towels to axillae (armpits), groin, and neck where major blood vessels transit.',
      '4. If conscious and able to swallow, administer chilled Oral Rehydration Solution (ORS) or electrolyte water in slow sips.',
      '5. If altered mental state, vomiting, or seizing: Place in lateral recovery position, withhold oral fluids, and prep IV saline line.'
    ]
  },
  'landslide-injury': {
    id: 'landslide-injury',
    title: 'Landslide / Rockfall Trauma',
    icon: 'mountain',
    keywords: ['rockfall', 'mudslide', 'debris', 'blunt impact', 'laceration', 'head trauma', 'buried', 'puncture', 'भूस्खलन', 'चट्टान', 'ching leikhom', 'leibak chumba'],
    defaultPriority: 'RED',
    goldenHourMinutes: 30,
    phcType: 'Disaster Relief Mobile Field Hospital',
    firstAidSteps: [
      '1. Ensure surrounding slope is momentarily stable before initiating extrication.',
      '2. Clear mouth and airways of silt, mud, and foreign debris to prevent aspiration asphyxiation.',
      '3. Suspect cervical/spinal injury: Maintain strict in-line head and neck immobilization; do NOT twist or fold spine.',
      '4. Dress open puncture wounds with sterile gauze. Do NOT extract deep impaled objects on scene.',
      '5. Wrap casualty in thermal survival foil to counter rapid hypothermia from wet mud exposure.'
    ]
  },
  'cardiac-respiratory': {
    id: 'cardiac-respiratory',
    title: 'Cardiac / Respiratory Distress',
    icon: 'heart-pulse',
    keywords: ['chest pain', 'heart attack', 'shortness of breath', 'asthma', 'choking', 'gasping', 'cyanosis', 'blue lips', 'lips are blue', 'cardiac', 'सीने', 'सांस', 'हार्ट', 'दिल', 'thamoi', 'thawa'],
    defaultPriority: 'RED',
    goldenHourMinutes: 15,
    phcType: 'Cardiac ICU & Advanced Life Support (ALS) Ambulance',
    firstAidSteps: [
      '1. Position patient in comfortable semi-seated upright position to minimize cardiac work.',
      '2. Loosen collar, belt, and tight garments to maximize chest expansion.',
      '3. Ask if patient carries prescribed sublingual Nitroglycerin or Asthma bronchodilator inhaler; assist administration.',
      '4. Administer chewable Aspirin (300mg) if cardiac infarction is suspected and no contraindication/allergy exists.',
      '5. Connect pulse oximeter / AED (Automated External Defibrillator) if available; prepare for immediate resuscitation.'
    ]
  },
  'minor-sprain-abrasion': {
    id: 'minor-sprain-abrasion',
    title: 'Minor Walking Wounded / Sprain & Cuts',
    icon: 'shield-check',
    keywords: ['twisted ankle', 'scrapes', 'minor cut', 'blisters', 'fatigue', 'mild bruise', 'मोच', 'खरोंच', 'khong yetpa', 'asokpa'],
    defaultPriority: 'GREEN',
    goldenHourMinutes: 120,
    phcType: 'First-Aid Post / Outpatient PHC Desk',
    firstAidSteps: [
      '1. Clean superficial abrasions thoroughly with antiseptic solution and apply sterile dressing.',
      '2. For ankle or joint sprains: Apply R.I.C.E. protocol (Rest, Ice pack, Compression bandage, Elevation).',
      '3. Provide oral hydration and rest in shaded observation bay for 30 minutes before discharge.'
    ]
  }
};

/**
 * Client-Side Multilingual NLP Clinical Classifier (Zero-network fallback)
 * Evaluates free-text emergency descriptions in English, Hindi, and Manipuri.
 * @param {string} text - User emergency narrative
 * @returns {Object} Classified condition, priority, detected physiological flags
 */
export function classifySymptomsNLP(text = '') {
  const raw = text.toLowerCase().trim();
  
  // Detect language
  let detectedLang = 'en';
  if (/[\u0900-\u097F]/.test(raw)) detectedLang = 'hi';
  else if (/[\uABC0-\uABFF]/.test(raw) || /thamoi|kanba|asokpa|leikhom|thawa/.test(raw)) detectedLang = 'mni';

  // This keyword matcher cannot safely interpret negation. Return unknown for review.
  const needsReview = /\b(no|not|without|denies|denied|never)\b|नहीं|नही/.test(raw);
  if (needsReview) return {conditionId: null, consciousness: 'unknown', severeBleeding: false,
    breathingDifficulty: false, pulseRate: null, languageDetected: detectedLang,
    confidenceScore: 0, needsReview: true};

  // Condition scoring
  let bestMatch = null;
  let highestScore = 0;

  for (const [key, config] of Object.entries(TRIAGE_CATEGORIES)) {
    let score = 0;
    for (const kw of config.keywords) {
      if (raw.includes(kw.toLowerCase())) {
        score += (kw.length > 5 ? 3 : 2);
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = key;
    }
  }

  // Detect critical vitals from text
  const unconsciousMatch = /unconscious|unresponsive|coma|fainted|behos|बेहोश|अचेत|mangkhre|wakhal leitaba/.test(raw);
  const bleedingMatch = /bleed|hemorrhage|arterial|blood|khoon|खून|रक्त|\bee\b|ee thorak/.test(raw);
  const breathingMatch = /breath|dyspnea|choking|asphyxia|suffocat|gasp|cyanosis|blue lips|lips are blue|सांस|thamoi na|thawa/.test(raw);

  const consciousness = unconsciousMatch ? 'unconscious' : /dizzy|confused|delirious|चक्कर/.test(raw) ? 'altered' : 'conscious';
  
  return {
    conditionId: bestMatch,
    consciousness,
    severeBleeding: bleedingMatch,
    breathingDifficulty: breathingMatch,
    pulseRate: null, // A text keyword is not a measured pulse.
    languageDetected: detectedLang,
    confidenceScore: highestScore > 0 ? Math.min(0.95, 0.5 + highestScore * 0.1) : 0.4
  };
}

/**
 * AI Emergency Medical Triage Assessment
 * Evaluates conditions and patient vitals using START & Manchester Triage guidelines
 * @param {Object} input - { conditionId, symptomsText, consciousness, breathingDifficulty, severeBleeding, pulseRate }
 * @returns {Object} Triage result with priority, action steps, nearest PHC recommendations
 */
export function computeMedicalTriage(input = {}) {
  let {
    conditionId = null,
    symptomsText = '',
    consciousness = 'conscious',
    breathingDifficulty = false,
    severeBleeding = false,
    pulseRate = null
  } = input;

  // If free-text symptoms are provided, run NLP classifier to auto-detect condition & vitals if not explicitly set
  if (symptomsText && symptomsText.trim().length > 3) {
    const nlp = classifySymptomsNLP(symptomsText);
    if (!conditionId || conditionId === 'auto') {
      conditionId = nlp.conditionId;
    }
    if (nlp.consciousness === 'unconscious') consciousness = 'unconscious';
    else if (nlp.consciousness === 'altered' && consciousness !== 'unconscious') consciousness = 'altered';
    if (nlp.severeBleeding) severeBleeding = true;
    if (nlp.breathingDifficulty) breathingDifficulty = true;

  }

  const baseConfig = TRIAGE_CATEGORIES[conditionId];
  if (!baseConfig || (symptomsText && classifySymptomsNLP(symptomsText).needsReview)) {
    return {
      triageId: `TRG-${globalThis.crypto.randomUUID()}`, conditionId: null,
      conditionTitle: 'Unclassified request', priority: 'UNKNOWN', priorityLabel: 'Needs human review',
      badgeColor: '#64748b', badgeClass: 'badge-ghost', goldenHourMinutes: null,
      urgencyDescription: 'No reliable category available from these inputs.',
      clinicalReason: 'Unknown or ambiguous input. No clinical conclusion established.',
      firstAidSteps: [], recommendedFacility: 'Not assigned',
      vitalsRecorded: {consciousness: input.consciousness ?? 'unknown', severeBleeding: input.severeBleeding ?? null,
        breathingDifficulty: input.breathingDifficulty ?? null, pulseRate: input.pulseRate ?? null},
      symptomsDescription: symptomsText, timestamp: new Date().toISOString()
    };
  }
  if (pulseRate !== null) finiteInput(pulseRate, 'pulse rate', 1, 300);
  
  // Dynamic Priority Escalation
  let priority = baseConfig.defaultPriority;
  let reason = 'Standard presentation';

  if (consciousness === 'unconscious' || severeBleeding || (breathingDifficulty && conditionId === 'cardiac-respiratory')) {
    priority = 'RED';
    reason = 'Life-threatening physiological crisis detected: Compromised airway, severe bleeding, or unconsciousness.';
  } else if (consciousness === 'altered' || breathingDifficulty || (pulseRate !== null && (pulseRate > 120 || pulseRate < 45))) {
    priority = (priority === 'GREEN') ? 'YELLOW' : priority;
    reason = 'Elevated clinical risk: Altered consciousness, dyspnea, or abnormal hemodynamics.';
  }

  // Triage Labels & Visual Badges
  let priorityLabel = 'Red - Immediate';
  let badgeColor = '#ef4444';
  let badgeClass = 'badge-error';
  let urgencyDescription = 'P1 Critical: Rapid Golden-Hour window (< 15-30 mins). Immediate surgical / ICU resuscitation dispatch required.';

  if (priority === 'YELLOW') {
    priorityLabel = 'Yellow - Urgent';
    badgeColor = '#f59e0b';
    badgeClass = 'badge-warning';
    urgencyDescription = 'P2 Urgent: Serious clinical condition. Requires stabilization & ALS transport within 45-60 minutes.';
  } else if (priority === 'GREEN') {
    priorityLabel = 'Green - Minor';
    badgeColor = '#10b981';
    badgeClass = 'badge-success';
    urgencyDescription = 'P3 Minor: Walking wounded. Can be triaged and treated at localized field first-aid tents.';
  }

  return {
    triageId: `TRG-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
    conditionId: baseConfig.id,
    conditionTitle: baseConfig.title,
    priority,
    priorityLabel,
    badgeColor,
    badgeClass,
    goldenHourMinutes: baseConfig.goldenHourMinutes,
    urgencyDescription,
    clinicalReason: reason,
    firstAidSteps: baseConfig.firstAidSteps,
    recommendedFacility: baseConfig.phcType,
    vitalsRecorded: {
      consciousness,
      breathingDifficulty: Boolean(breathingDifficulty),
      severeBleeding: Boolean(severeBleeding),
      pulseRate: pulseRate === null ? null : Number(pulseRate)
    },
    symptomsDescription: symptomsText || baseConfig.title,
    timestamp: new Date().toISOString()
  };
}

/**
 * Offline Template Synthesis for Disaster Evacuation Briefing (Gemini Fallback)
 * @param {Object} riskResult 
 * @returns {string} Structured evacuation bulletin
 */
export function generateOfflineDisasterBriefing(riskResult) {
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const isCritical = riskResult.riskLevel === 'Critical';
  
  return `📢 EXPERIMENTAL SCENARIO SUMMARY — NOT AN OFFICIAL WARNING
Issued: ${dateStr} | Status: ${riskResult.riskLevel.toUpperCase()} THREAT LEVEL

📍 TARGET SECTOR: ${riskResult.terrainName} (${riskResult.category})
⚠️ COMPOSITE RISK SCORE: ${riskResult.compositeScore}% | Landslide: ${riskResult.landslideProbability}% | Flash-Flood: ${riskResult.floodProbability}%

METEOROLOGICAL & GEOLOGICAL TELEMETRY:
• Rainfall Intensity: ${riskResult.metrics.rainfallMmH} mm/h | Humidity: ${riskResult.metrics.humidityPercent}%
• Topographic Gradient: ${riskResult.metrics.slopeAngleDeg}° (${riskResult.metrics.slopeCoefficient}% slope factor)
• Barometric Pressure: ${riskResult.metrics.pressureHpa} hPa (Depression Anomaly: ${Math.max(0, 1013 - riskResult.metrics.pressureHpa)} hPa)

DIRECTIVES FOR TRAVELERS & FIRST RESPONDERS:
${isCritical ? '1. 🛑 IMMEDIATE TRANSIT HALT: Do not proceed past transit checkpoints.' : '1. ⚠️ CAUTION ADVISORY: Maintain safe vehicle separation and reduce speeds.'}
2. Mapped or sample facilities (unverified): ${riskResult.safeShelters.join(", ") || "Unavailable"}. Confirm official shelter information locally.
3. 🚫 AVOID CHOKEPOINTS: Steer clear of ${riskResult.highRiskZones.join(' and ')}.
4. Check official local advisories. No responder or satellite dispatch is connected to this prototype.`;
}
