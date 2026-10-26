/**
 * ExploreGuard AI Disaster Risk & Triage Engine
 * Hack for Social Cause (VBYLD 2027)
 * Theme: Disaster Mitigation, Kumbh Mela & Health Service Delivery
 */

// Regional Terrain Vulnerability Profiles
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
 * Computes AI Multi-Hazard Risk, Landslide & Flash-Flood Probabilities
 * @param {Object} weather - Telemetry data { rainfall, humidity, windSpeed, pressure }
 * @param {string} terrainKey - Key matching TERRAIN_PROFILES
 * @returns {Object} Comprehensive hazard assessment
 */
export function computeDisasterRisk(weather = {}, terrainKey = 'nh-37') {
  const terrain = TERRAIN_PROFILES[terrainKey] || TERRAIN_PROFILES['nh-37'];

  const rainfall = Number(weather.rainfall ?? 0);     // mm/hr
  const humidity = Number(weather.humidity ?? 60);    // %
  const windSpeed = Number(weather.windSpeed ?? 15);  // km/h
  const pressure = Number(weather.pressure ?? 1013);  // hPa

  // 1. Normalized Weather Indices
  // Rainfall index: 0-10 mm is light (0-0.25), 10-35 mm is moderate (0.25-0.7), >35 mm is cloudburst/severe (>0.7)
  let rainIndex = 0;
  if (rainfall <= 0) rainIndex = 0.05; // Base ambient moisture
  else if (rainfall <= 15) rainIndex = 0.05 + (rainfall / 15) * 0.35;
  else if (rainfall <= 40) rainIndex = 0.40 + ((rainfall - 15) / 25) * 0.35;
  else rainIndex = Math.min(1.0, 0.75 + ((rainfall - 40) / 40) * 0.25);

  // Humidity Index (saturated air >= 85% prevents slope evaporation and accelerates liquefaction)
  const humidityIndex = Math.max(0, Math.min(1.0, (humidity - 40) / 60));

  // Barometric Depression Index (pressure < 1010 hPa signals cyclone/monsoon depression)
  let pressureIndex = 0;
  if (pressure < 1013) {
    pressureIndex = Math.min(1.0, (1013 - pressure) / 20);
  }

  // Wind shear contribution (influences tree-fall and slope crest vibration)
  const windIndex = Math.min(1.0, windSpeed / 75);

  // 2. Landslide Probability Formula
  // Weighted: Rainfall (40%) + Soil Saturation/Humidity (20%) + Terrain Slope & Fragility (30%) + Barometric/Wind (10%)
  const terrainSlopeFragility = (terrain.slopeWeight * 0.55) + (terrain.soilFragility * 0.45);
  
  const rawLandslide = (
    rainIndex * 0.42 +
    humidityIndex * 0.18 +
    terrainSlopeFragility * 0.30 +
    (pressureIndex * 0.06 + windIndex * 0.04)
  ) * terrain.historyWeight * 105;

  const landslideProb = Math.max(5, Math.min(99, Math.round(rawLandslide)));

  // 3. Flash-Flood Probability Formula
  // Weighted: Rainfall (55%) + Flood Plain Vulnerability (25%) + Humidity (12%) + Barometric (8%)
  const rawFlood = (
    rainIndex * 0.52 +
    terrain.floodVulnerability * 0.28 +
    humidityIndex * 0.12 +
    pressureIndex * 0.08
  ) * 100;

  const floodProb = Math.max(4, Math.min(99, Math.round(rawFlood)));

  // 4. Composite Multi-Hazard Score
  // Emphasizes primary risk while factoring secondary compound danger
  const dominantProb = Math.max(landslideProb, floodProb);
  const secondaryProb = Math.min(landslideProb, floodProb);
  const compositeScore = Math.round(dominantProb * 0.75 + secondaryProb * 0.25);

  // 5. Risk Tier & Badge
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

  // 6. Actionable Recommended Evacuation Protocol
  let evacuationAction = '';
  if (riskLevel === 'Critical') {
    if (landslideProb >= floodProb) {
      evacuationAction = `HALT TRANSIT IMMEDIATELY along ${terrain.name}. Debris flow risk high at ${terrain.highRiskZones.join(' & ')}. Evacuate downhill vehicles to designated shelter: ${terrain.safeShelters[0]}.`;
    } else {
      evacuationAction = `FLASH-FLOOD WARNING for ${terrain.name}. Inundation rapid. Move all personnel & vehicles to high ground shelters at ${terrain.safeShelters[0]}. Avoid culverts and riverbanks.`;
    }
  } else if (riskLevel === 'Moderate') {
    if (landslideProb >= floodProb) {
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
      floodPlainIndex: Math.round(terrain.floodVulnerability * 100)
    },
    safeShelters: terrain.safeShelters,
    highRiskZones: terrain.highRiskZones,
    timestamp: new Date().toISOString()
  };
}

// Kumbh Mela & Mass Gathering Sector Baselines
export const CROWD_SECTORS = {
  'sector-a': {
    id: 'sector-a',
    name: 'Sector A: Sangam Holy Bathing Ghat',
    location: 'Triveni Sangam Riverbank Confluence',
    areaSqM: 6000,
    safeCapacity: 12000,
    designMaxDensity: 2.0, // persons / m²
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
    designMaxDensity: 1.0, // Must remain low for ambulance flow
    evacuationRoutes: ['Trauma Center Fast-Track', 'Helipad Access Artery', 'Civil Hospital Radial'],
    currentCount: 3600,
    inflowPerMin: 95,
    outflowPerMin: 110
  }
};

/**
 * Computes Crowd Density, Stampede Hazard, Bottleneck Detection & Decongestion Routing
 * @param {string} sectorId
 * @param {number} customCountOverride - optional simulation count
 * @returns {Object} Crowd telemetry & safety guidance
 */
export function computeCrowdRisk(sectorId = 'sector-a', customCountOverride = null) {
  const sector = CROWD_SECTORS[sectorId] || CROWD_SECTORS['sector-a'];
  const count = customCountOverride !== null ? Number(customCountOverride) : sector.currentCount;
  
  const density = +(count / sector.areaSqM).toFixed(2); // persons / m²
  const flowRatio = +(sector.inflowPerMin / Math.max(1, sector.outflowPerMin)).toFixed(2);

  // Fruin Pedestrian Level of Service (LoS):
  // < 2.0: Safe (Free flow)
  // 2.0 - 4.0: Moderate (Constrained, slow walking)
  // > 4.0: Critical (Shockwave compression, extreme stampede danger)
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
    decongestionRouting = `CRITICAL DECONGESTION ACTIVATED: Inflow exceeds egress by ${(flowRatio * 100).toFixed(0)}%. Close barrier gates at inflow corridor. Divert oncoming pilgrim surge through ${sector.evacuationRoutes[0]} toward ${sector.evacuationRoutes[1]}. Dispatch Quick Reaction Force (QRF).`;
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

// Emergency Medical Triage Knowledge Base (START + Manchester Triage Systems)
export const TRIAGE_CATEGORIES = {
  'stampede-trauma': {
    id: 'stampede-trauma',
    title: 'Stampede Trauma / Crush Injury',
    icon: 'activity',
    keywords: ['crush', 'trampled', 'chest compression', 'suffocation', 'asphyxia', 'limb fracture', 'unconscious', 'pelvic trauma'],
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
    keywords: ['heat', 'fainting', 'high fever', 'no sweat', 'delirium', 'confusion', 'dizziness', 'parched', 'hyperthermia'],
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
    keywords: ['rockfall', 'mudslide', 'debris', 'blunt impact', 'laceration', 'head trauma', 'buried', 'puncture'],
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
    keywords: ['chest pain', 'heart attack', 'shortness of breath', 'asthma', 'choking', 'gasping', 'cyanosis', 'blue lips'],
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
    keywords: ['twisted ankle', 'scrapes', 'minor cut', 'blisters', 'fatigue', 'mild bruise'],
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
 * AI Emergency Medical Triage Assessment
 * Evaluates conditions and patient vitals using START & Manchester Triage guidelines
 * @param {Object} input - { conditionId, symptomsText, consciousness, breathingDifficulty, severeBleeding, pulseRate }
 * @returns {Object} Triage result with priority, action steps, nearest PHC recommendations
 */
export function computeMedicalTriage(input = {}) {
  const {
    conditionId = 'stampede-trauma',
    symptomsText = '',
    consciousness = 'conscious', // 'conscious' | 'altered' | 'unconscious'
    breathingDifficulty = false,
    severeBleeding = false,
    pulseRate = 80
  } = input;

  const baseConfig = TRIAGE_CATEGORIES[conditionId] || TRIAGE_CATEGORIES['stampede-trauma'];
  
  // Dynamic Priority Escalation
  let priority = baseConfig.defaultPriority;
  let reason = 'Standard presentation';

  if (consciousness === 'unconscious' || severeBleeding || (breathingDifficulty && conditionId === 'cardiac-respiratory')) {
    priority = 'RED';
    reason = 'Life-threatening physiological crisis detected: Compromised airway, severe bleeding, or unconsciousness.';
  } else if (consciousness === 'altered' || breathingDifficulty || pulseRate > 120 || pulseRate < 45) {
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
      pulseRate: Number(pulseRate)
    },
    symptomsDescription: symptomsText || baseConfig.title,
    timestamp: new Date().toISOString()
  };
}
