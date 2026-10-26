/**
 * Automated Validation Test Suite for ExploreGuard AI Risk & Triage Engine
 * Theme: Disaster Mitigation, Kumbh Mela & Health Service Delivery (VBYLD 2027)
 */

import { computeDisasterRisk, computeCrowdRisk, computeMedicalTriage, TERRAIN_PROFILES, CROWD_SECTORS } from '../js/risk-engine.js';
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

console.log('===============================================================');
console.log('🧪 Starting ExploreGuard AI Engine Validation Suite (VBYLD 2027)');
console.log('===============================================================\n');

// 1. Verify Sample Data Integrity
console.log('▶ [1/4] Testing Sample Data Repository Integrity...');
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

// 2. Test AI Multi-Hazard & Landslide Risk Engine
console.log('\n▶ [2/4] Testing AI Multi-Hazard & Landslide Risk Calculations...');

// Test 2.1: Severe Monsoon Cloudburst on NH-37 (High Vulnerability Corridor)
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

// Test 2.2: Dry Clear Transit Weather on NH-37
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

// Test 2.3: Flood Plain Inundation in Imphal Valley (Thoubal Basin)
const valleyStorm = {
  rainfall: 55,
  humidity: 92,
  windSpeed: 18,
  pressure: 1004
};
const valleyRisk = computeDisasterRisk(valleyStorm, 'imphal-valley');
assert(valleyRisk.floodProbability >= valleyRisk.landslideProbability, 'Imphal Valley prioritizes flash-flood probability over landslide');
assert(valleyRisk.evacuationAction.includes('FLASH-FLOOD') || valleyRisk.evacuationAction.includes('high ground'), 'Generates flash-flood specific evacuation advisory');

// 3. Test Kumbh Mela & Mass-Gathering Crowd Telemetry
console.log('\n▶ [3/4] Testing Kumbh Mela Crowd Telemetry & Bottleneck Detection...');

// Test 3.1: Safe Crowd Flow in Relief Camp
const safeCamp = computeCrowdRisk('sector-c', 14000); // 14,000 people in 14,000 sq.m = 1.0 p/sq.m
assert(safeCamp.stampedeRisk === 'Safe', 'Relief camp zone at 1.0 p/m² is classified as "Safe"');
assert(safeCamp.bottleneckTriggered === false, 'Bottleneck trigger remains false when flow is smooth');
assert(safeCamp.densityPersonsPerSqM === 1.0, `Density correctly calculated as 1.00 p/m²`);

// Test 3.2: Critical Stampede Hazard at Transit Hub Pontoon Bridges
const surgeTransitHub = computeCrowdRisk('sector-b', 36000); // 36,000 in 7,500 sq.m = 4.8 p/sq.m
assert(surgeTransitHub.stampedeRisk === 'Critical', 'Crowd density of 4.8 p/m² triggers "Critical" stampede risk');
assert(surgeTransitHub.bottleneckTriggered === true, 'Bottleneck trigger activated');
assert(surgeTransitHub.decongestionRouting.includes('CRITICAL DECONGESTION ACTIVATED'), 'Automated decongestion rerouting instruction generated');
assert(surgeTransitHub.badgeClass === 'badge-error', 'Assigned DaisyUI error badge for critical crowd alert');

// 4. Test AI Emergency Medical Triage & Dispatch
console.log('\n▶ [4/4] Testing AI Golden-Hour Medical Triage & Health Delivery...');

// Test 4.1: Red Priority - Stampede Crush Injury with Unconsciousness
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

// Test 4.2: Severe Bleeding Trauma from Landslide Rockfall
const rockfallTriage = computeMedicalTriage({
  conditionId: 'landslide-injury',
  symptomsText: 'Deep scalp laceration, open compound arm fracture',
  consciousness: 'conscious',
  breathingDifficulty: false,
  severeBleeding: true,
  pulseRate: 105
});
assert(rockfallTriage.priority === 'RED', 'Trauma with severe active hemorrhage escalated to RED');

// Test 4.3: Green Priority - Minor Walking Wounded / Sprain
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

console.log('\n===============================================================');
console.log(`📊 Test Results: ${passCount} Passed, ${failCount} Failed`);
if (failCount === 0) {
  console.log('🎉 ALL VALIDATION TESTS PASSED SUCCESSFULLY! Ready for Hackathon.');
  console.log('===============================================================');
  process.exit(0);
} else {
  console.error('⚠️ Some tests failed. Review issues above.');
  console.log('===============================================================');
  process.exit(1);
}
