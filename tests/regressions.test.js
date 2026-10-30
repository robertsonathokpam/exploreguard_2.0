import test from 'node:test';
import assert from 'node:assert/strict';
import {computeDisasterRisk, computeCrowdRisk, classifySymptomsNLP, computeMedicalTriage, estimateSlopeFromElevationGrid} from '../js/risk-engine.js';
import {hourlyRain, escapeHtml} from '../js/data-utils.js';

test('Invalid weather cannot produce a Low risk result', () => {
  for (const rainfall of [-1, 'abc', Infinity, NaN]) assert.throws(() => computeDisasterRisk({rainfall}), RangeError);
  assert.throws(() => computeDisasterRisk({humidity: 101}), RangeError);
});
test('Invalid count or area cannot produce a Safe crowd result', () => {
  for (const count of [-1, 'abc', Infinity, '']) assert.throws(() => computeCrowdRisk('sector-a', count), RangeError);
  assert.throws(() => computeCrowdRisk('a', 5, {sectors: {a: {areaSqM: 0}}}), RangeError);
  assert.equal(computeCrowdRisk('sector-a', 0).densityPersonsPerSqM, 0);
});
test('Negated statements and unrelated text require review, without invented pulse', () => {
  const text = 'No bleeding and no breathing difficulty. Patient is not unconscious.';
  assert.equal(classifySymptomsNLP(text).needsReview, true);
  assert.equal(computeMedicalTriage({symptomsText: text}).priority, 'UNKNOWN');
  assert.equal(computeMedicalTriage({symptomsText: 'hello'}).conditionId, null);
  assert.equal(classifySymptomsNLP('bleeding').pulseRate, null);
});
test('Terrain gradient adjusts east-west distance for latitude', () => {
  const eq = estimateSlopeFromElevationGrid(100, 100, 100, 200, 0, .005, 0);
  const north = estimateSlopeFromElevationGrid(100, 100, 100, 200, 0, .005, 60);
  assert.ok(north.slopeAngleDeg > eq.slopeAngleDeg);
  assert.throws(() => estimateSlopeFromElevationGrid(null,100,100,100,100));
});
test('Rainfall uses one-hour values including zero, or the three-hour hourly average', () => {
  assert.equal(hourlyRain({rain:{'1h':0,'3h':9}}), 0);
  assert.equal(hourlyRain({rain:{'3h':9}}), 3);
  assert.equal(hourlyRain({}), 0);
  assert.throws(() => hourlyRain({rain:{'1h':-1}}));
});
test('Stored user values are escaped before insertion as HTML', () => {
  assert.equal(escapeHtml('<img src=x onerror="boom()">'), '&lt;img src=x onerror=&quot;boom()&quot;&gt;');
});
