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

// New provider/model contracts, independent of legacy simulation calculations.
import {parseWeather, parseElevation, validateCoordinates} from '../js/environment-data.js';
import {createPersonDetector} from '../js/vision-model.js';
test('Missing weather is unknown while an explicit provider zero remains zero', () => {
  const data = parseWeather({current:{time:'2026-10-30T12:00',temperature_2m:null,precipitation:0,interval:900}});
  assert.equal(data.temperature,null); assert.equal(data.precipitation,0); assert.equal(data.interval,900);
  assert.equal(data.humidity,null);
  assert.throws(()=>parseWeather({}));
  assert.throws(()=>parseElevation({elevation:[1,2,null,4,5]},24,94));
  assert.doesNotThrow(()=>validateCoordinates(0,0));
  assert.throws(()=>validateCoordinates(91,0));
});
test('RT-DETR adapter uses model output pixel boxes and never fabricates people', async () => {
  let returned = []; let settings, options;
  const model = await createPersonDetector('rtdetr', {loadTransformers:async()=>({
    env:{backends:{onnx:{wasm:{}}}}, RawImage:class {constructor(data,width,height,channels){this.width=width;}},
    pipeline:async(task,id,config)=>{settings={task,id,config};return async(image,opts)=>{options=opts;return returned;};}
  })});
  const canvas={width:640,height:480,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(4)})})};
  assert.deepEqual(await model.detect(canvas,200,.35),[]);
  returned=[{label:'person',score:.8,box:{xmin:10,ymin:20,xmax:40,ymax:80}},{label:'car',score:.9,box:{}}];
  assert.deepEqual(await model.detect(canvas,200,.35),[{class:'person',score:.8,bbox:[10,20,30,60]}]);
  assert.equal(settings.id,'onnx-community/rtdetr_r18vd'); assert.equal(settings.config.dtype,'q8');
  assert.equal(options.percentage,false);
});
test('Lighter detector explicitly loads full MobileNet V2 rather than Lite', async () => {
  let config; const detector={detect(){}};
  assert.equal(await createPersonDetector('mobilenet',{cocoSsd:{load:async c=>{config=c;return detector;}}}),detector);
  assert.equal(config.base,'mobilenet_v2');
});
