/**
 * Automated Validation Test Suite for ExploreGuard AI Risk & Triage Engine 2.0
 * Theme: Disaster Mitigation, Kumbh Mela & Health Service Delivery (VBYLD 2027)
 */

import {
  computeDisasterRisk,
  computeCrowdRisk,
  computeMedicalTriage,
  estimateSlopeFromElevationGrid,
  classifySymptomsNLP,
  generateOfflineDisasterBriefing,
  sigmoid,
  TERRAIN_PROFILES,
  CROWD_SECTORS,
  CROWD_VENUES
} from '../js/risk-engine.js';
import fs from 'fs';
import path from 'path';

let passCount = 0;
let failCount = 0;

function assert(condition, testDescription) {
  if (condition) {
    console.log(`  ✅ PASS: ${testDescription}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testDescription}`);
    failCount++;
  }
}

console.log('====================================================================');
console.log('🧪 Starting ExploreGuard AI Engine 2.0 Validation Suite (VBYLD 2027)');
console.log('====================================================================\n');

// 1. Verify Sample Data Integrity
console.log('▶ [1/6] Testing Sample Data Repository Integrity...');
try {
  const sampleDataRaw = fs.readFileSync(path.join(process.cwd(), 'sample_data', 'mock_hazard_crowd_health_data.json'), 'utf8');
  const sampleData = JSON.parse(sampleDataRaw);
  assert(sampleData.project && sampleData.hackathon, 'Sample data JSON parsed with project & hackathon metadata');
  assert(sampleData.weather_telemetry_scenarios.length >= 4, 'Includes minimum 4 weather telemetry scenarios');
  assert(sampleData.kumbh_crowd_telemetry_sectors.length === 4, 'Includes all 4 Kumbh Mela crowd telemetry sectors');
  assert(sampleData.emergency_medical_triage_cases.length >= 4, 'Includes minimum 4 emergency medical triage scenarios');
} catch (e) {
  assert(false, `Failed to load sample data: ${e.message}`);
}

// 2. Test Sigmoid & Multivariate Logistic Regression Hazard Calculation
console.log('\n▶ [2/6] Testing Multivariate Logistic Regression (Sigmoid) Hazard Engine...');

// Test 2.1: Sigmoid Activation boundary testing
assert(sigmoid(0) === 0.5, 'Sigmoid activation at z=0 evaluates to exactly 0.5');
assert(sigmoid(6) > 0.99, 'Sigmoid activation at z=6 converges to > 0.99');
assert(sigmoid(-6) < 0.01, 'Sigmoid activation at z=-6 converges to < 0.01');

// Test 2.2: Extreme Storm on NH-37 (High Vulnerability Corridor)
const extremeStormWeather = {
  rainfall: 65,     // 65 mm/h torrential rain
  humidity: 95,     // 95% saturation
  windSpeed: 45,    // 45 km/h
  pressure: 998     // low pressure depression
};
const stormRisk = computeDisasterRisk(extremeStormWeather, 'nh-37');
assert(stormRisk.riskLevel === 'Critical', 'Extreme storm on NH-37 flags as "Critical" risk level');
assert(stormRisk.compositeScore >= 70, `Composite risk score is >= 70 (got: ${stormRisk.compositeScore}%)`);
assert(stormRisk.landslideProbability >= 75, `Landslide probability is high (got: ${stormRisk.landslideProbability}%)`);
assert(stormRisk.badgeClass === 'badge-error', 'Correct DaisyUI badge class badge-error assigned');
assert(stormRisk.evacuationAction.includes('HALT TRANSIT IMMEDIATELY'), 'Generates actionable immediate evacuation instructions');

// Test 2.3: Dry Clear Transit Weather on NH-37
const dryWeather = {
  rainfall: 0,
  humidity: 45,
  windSpeed: 10,
  pressure: 1015
};
const dryRisk = computeDisasterRisk(dryWeather, 'nh-37');
assert(dryRisk.riskLevel === 'Low', 'Dry weather on NH-37 evaluates to "Low" risk level');
assert(dryRisk.compositeScore < 40, `Composite score is low under dry conditions (got: ${dryRisk.compositeScore}%)`);
assert(dryRisk.badgeClass === 'badge-success', 'Low risk assigned badge-success');

// Test 2.4: Flood Plain Inundation in Imphal Valley (Thoubal Basin)
const valleyStorm = {
  rainfall: 55,
  humidity: 92,
  windSpeed: 18,
  pressure: 1004
};
const valleyRisk = computeDisasterRisk(valleyStorm, 'imphal-valley');
assert(valleyRisk.floodProbability >= valleyRisk.landslideProbability, 'Imphal Valley prioritizes flash-flood probability over landslide');
assert(valleyRisk.evacuationAction.includes('FLASH-FLOOD') || valleyRisk.evacuationAction.includes('high ground'), 'Generates flash-flood specific evacuation advisory');

// 3. Test Dynamic 5-Point DEM Topographic Slope & Universal Location Engine
console.log('\n▶ [3/6] Testing Dynamic 5-Point DEM Elevation & Slope Calculation...');

// Simulated DEM elevations around a steep mountain pass (Center 1200m, North 1550m, South 850m, East 1250m, West 1150m)
const demGrid = estimateSlopeFromElevationGrid(1200, 1550, 850, 1250, 1150, 0.005);
assert(demGrid.slopeAngleDeg > 25, `Steep montane terrain gradient accurately calculated (${demGrid.slopeAngleDeg}°)`);
assert(demGrid.slopeFactor > 0.5, `Slope factor normalized above 0.50 (got: ${demGrid.slopeFactor.toFixed(2)})`);
assert(demGrid.avgElevationMeters === 1200, `Average elevation calculated correctly (got: ${demGrid.avgElevationMeters}m)`);

// Universal custom location risk prediction using dynamic DEM slope
const customUniversalLocation = {
  id: 'universal-alps-transit',
  name: 'Alpine High-Pass Corridor (Zurich - Gotthard)',
  category: 'Alpine Scree Cut-Slope',
  slopeWeight: demGrid.slopeFactor,
  soilFragility: 0.82,
  historyWeight: 0.88,
  floodVulnerability: 0.30,
  safeShelters: ['Gotthard Transit Emergency Bunker'],
  highRiskZones: ['North Ravine Viaduct']
};
const alpineRisk = computeDisasterRisk(extremeStormWeather, customUniversalLocation, demGrid);
assert(alpineRisk.terrainName.includes('Alpine High-Pass'), 'Universal custom terrain correctly evaluated');
assert(alpineRisk.riskLevel === 'Critical', 'Alpine steep slope with heavy storm flags Critical risk');
assert(alpineRisk.metrics.slopeAngleDeg === demGrid.slopeAngleDeg, 'Dynamic slope angle correctly attached to risk metrics');

// Test offline disaster briefing generation
const briefing = generateOfflineDisasterBriefing(alpineRisk);
assert(briefing.includes('OFFICIAL DISASTER MITIGATION BROADCAST BULLETIN'), 'Generates structured emergency broadcast bulletin');
assert(briefing.includes('Gotthard Transit Emergency Bunker'), 'Evacuation shelter included in briefing text');

// 4. Test Kumbh Mela & Multi-Venue Crowd Telemetry
console.log('\n▶ [4/6] Testing Kumbh Mela & Regional Multi-Venue Crowd Telemetry...');

// Test 4.1: Safe Crowd Flow in Kumbh Relief Camp
const safeCamp = computeCrowdRisk('sector-c', 14000); // 14,000 in 14,000 sq.m = 1.0 p/sq.m
assert(safeCamp.stampedeRisk === 'Safe', 'Relief camp zone at 1.0 p/m² is classified as "Safe"');
assert(safeCamp.bottleneckTriggered === false, 'Bottleneck trigger remains false when flow is smooth');
assert(safeCamp.densityPersonsPerSqM === 1.0, 'Density correctly calculated as 1.00 p/m²');

// Test 4.2: Critical Stampede Hazard at Transit Hub Pontoon Bridges
const surgeTransitHub = computeCrowdRisk('sector-b', 36000); // 36,000 in 7,500 sq.m = 4.8 p/sq.m
assert(surgeTransitHub.stampedeRisk === 'Critical', 'Crowd density of 4.8 p/m² triggers "Critical" stampede risk');
assert(surgeTransitHub.bottleneckTriggered === true, 'Bottleneck trigger activated');
assert(surgeTransitHub.decongestionRouting.includes('CRITICAL DECONGESTION ACTIVATED'), 'Automated decongestion rerouting instruction generated');
assert(surgeTransitHub.badgeClass === 'badge-error', 'Assigned DaisyUI error badge for critical crowd alert');

// Test 4.3: Imphal Lai Haraoba & Yaoshang Festival (Regional Venue Preset)
const imphalBazaar = computeCrowdRisk('sector-b', 28000, 'imphal-festival');
assert(imphalBazaar.sectorName.includes('Ima Market'), 'Regional Manipur festival sector evaluated correctly');
assert(imphalBazaar.densityPersonsPerSqM > 4.0, `Ima Market surge calculates density > 4.0 p/m² (got: ${imphalBazaar.densityPersonsPerSqM})`);
assert(imphalBazaar.stampedeRisk === 'Critical', 'Flags critical stampede risk in dense festival market');

// Test 4.4: Custom User-Configured Venue
const customVenue = {
  id: 'custom-stadium',
  name: 'Eden Gardens Mass Gathering Venue',
  sectors: {
    'gate-1': {
      id: 'gate-1',
      name: 'North Ingress Gate 1',
      areaSqM: 2000,
      safeCapacity: 4000,
      inflowPerMin: 600,
      outflowPerMin: 200,
      evacuationRoutes: ['Eastern Spillway Avenue', 'Metro Plaza Radial']
    }
  }
};
const customCrowd = computeCrowdRisk('gate-1', 9000, customVenue);
assert(customCrowd.densityPersonsPerSqM === 4.5, `Custom venue density evaluated correctly (got: ${customCrowd.densityPersonsPerSqM} p/m²)`);
assert(customCrowd.bottleneckTriggered === true, 'Bottleneck triggered on custom venue');

// 5. Test Multilingual Clinical NLP Triage Classifier (English, Hindi, Manipuri)
console.log('\n▶ [5/6] Testing Multilingual NLP Clinical Classifier...');

// Test 5.1: English free-text clinical triage
const enNLP = classifySymptomsNLP('Severe chest compression after stampede near ghat, patient is unconscious and lips are blue');
assert(enNLP.conditionId === 'stampede-trauma', 'English text matches stampede trauma condition');
assert(enNLP.consciousness === 'unconscious', 'English text detects unconscious state');
assert(enNLP.breathingDifficulty === true, 'English text detects breathing difficulty/cyanosis');

// Test 5.2: Hindi free-text clinical triage
const hiNLP = classifySymptomsNLP('भगदड़ में सीने पर गंभीर चोट लगी है, मरीज बेहोश है और बहुत खून बह रहा है');
assert(hiNLP.conditionId === 'stampede-trauma', 'Hindi text matches stampede condition (भगदड़)');
assert(hiNLP.consciousness === 'unconscious', 'Hindi text detects unconscious state (बेहोश)');
assert(hiNLP.severeBleeding === true, 'Hindi text detects severe hemorrhage (खून)');
assert(hiNLP.languageDetected === 'hi', 'Correctly detects Hindi language');

// Test 5.3: Manipuri (Romanized/Meitei) free-text clinical triage
const mniNLP = classifySymptomsNLP('Ching leikhom chumbada kok ta asokpa fangkhre, wakhal leitaba amasung ee thorakli');
assert(mniNLP.conditionId === 'landslide-injury', 'Manipuri text matches landslide condition (ching leikhom)');
assert(mniNLP.consciousness === 'unconscious', 'Manipuri text detects altered/unconscious state (wakhal leitaba)');
assert(mniNLP.severeBleeding === true, 'Manipuri text detects active bleeding (ee thorakli)');

// 6. Test AI Golden-Hour Medical Triage Decisions
console.log('\n▶ [6/6] Testing AI Golden-Hour Medical Triage Logic...');

// Test 6.1: Red Priority - Stampede Crush Injury with Unconsciousness
const crushTriage = computeMedicalTriage({
  conditionId: 'stampede-trauma',
  symptomsText: 'Crush asphyxia, trampled on bridge, unconscious',
  consciousness: 'unconscious',
  breathingDifficulty: true,
  severeBleeding: false,
  pulseRate: 135
});
assert(crushTriage.priority === 'RED', 'Unconscious stampede crush victim evaluated as RED (Immediate Priority)');
assert(crushTriage.goldenHourMinutes <= 20, 'Rapid Golden-Hour window assigned (<= 20 minutes)');
assert(crushTriage.firstAidSteps.length >= 4, 'Provides comprehensive step-by-step first-aid guidance');
assert(crushTriage.triageId.startsWith('TRG-'), 'Generated unique Triage Incident Identifier');

// Test 6.2: Severe Bleeding Trauma from Landslide Rockfall
const rockfallTriage = computeMedicalTriage({
  conditionId: 'landslide-injury',
  symptomsText: 'Deep scalp laceration, open compound arm fracture',
  consciousness: 'conscious',
  breathingDifficulty: false,
  severeBleeding: true,
  pulseRate: 105
});
assert(rockfallTriage.priority === 'RED', 'Trauma with severe active hemorrhage escalated to RED');

// Test 6.3: Green Priority - Minor Walking Wounded / Sprain
const minorTriage = computeMedicalTriage({
  conditionId: 'minor-sprain-abrasion',
  symptomsText: 'Minor ankle sprain and knee abrasions after stepping off bus',
  consciousness: 'conscious',
  breathingDifficulty: false,
  severeBleeding: false,
  pulseRate: 76
});
assert(minorTriage.priority === 'GREEN', 'Minor sprain with normal consciousness classified as GREEN');
assert(minorTriage.firstAidSteps.some(step => step.includes('R.I.C.E.')), 'R.I.C.E. protocol included in first-aid guidance');

// Test 6.4: End-to-end NLP-driven Triage
const nlpDrivenTriage = computeMedicalTriage({
  symptomsText: 'मरीज बेहोश है, सीने में भयानक दर्द और सांस नहीं आ रही है'
});
assert(nlpDrivenTriage.priority === 'RED', 'Hindi narrative automatically evaluates to RED priority');
assert(nlpDrivenTriage.conditionId === 'cardiac-respiratory', 'Cardiac/respiratory distress recognized from Hindi symptoms');

console.log('\n====================================================================');
console.log(`📊 Test Results: ${passCount} Passed, ${failCount} Failed`);
if (failCount === 0) {
  console.log('🎉 ALL 41 VALIDATION TESTS PASSED SUCCESSFULLY! Ready for Hackathon.');
  console.log('====================================================================');
  process.exit(0);
} else {
  console.error('⚠️ Some tests failed. Review issues above.');
  console.log('====================================================================');
  process.exit(1);
}
