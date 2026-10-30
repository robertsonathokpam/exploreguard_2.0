import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../js/risk-engine.js';
import {createPersonDetector} from '../js/vision-model.js';
import {validateCoordinates, parseWeather, parseElevation, parseRiverForecast} from '../js/environment-data.js';

// Runs the real page controller with isolated DOM, model and database adapters.
// It does not contact production Firebase or claim model-accuracy validation.
function harness(file, overrides = {}, lineEnding = null) {
  const nodes = new Map();
  const element = () => ({textContent:'', innerHTML:'', value:'', checked:false, disabled:false,
    children:[], append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children}, style:{}, classList:{add(){},remove(){}}, setAttribute(){}, addEventListener(){},
    width:600,height:280, pixels:0,
    getContext(){ const owner=this; return {drawImage(src){owner.pixels=src.pixels ?? 0;},
      strokeRect(){owner.pixels++;},fillRect(){},fillText(){},measureText(){return {width:80};}}; }
  });
  const document = {getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},
    createElement:element,querySelector(){return element();},querySelectorAll(){return []}};
  const storage={getItem(k){return this[k]??null},setItem(k,v){this[k]=v},removeItem(k){delete this[k]}};
  let commits=0; const writes=[];
  const context={...engine,validateCoordinates,parseWeather,parseElevation,parseRiverForecast,AbortController,document,console:{log(){},warn(){}},performance,crypto,
    localStorage:storage,navigator:{},location:{origin:'http://localhost'},lucide:{createIcons(){}},
    auth:{},db:{},onAuthStateChanged(a,fn){fn({uid:'test-user',email:'test@example.invalid'});},
    doc(db,collection,id){return collection+'/'+id},
    writeBatch(){return {set(path,payload){writes.push({path,payload})},commit(){commits++;return Promise.resolve();}}},
    setDoc(){return Promise.resolve()},deleteDoc(){return Promise.resolve()},
    alert(){},setTimeout,clearTimeout,AbortSignal,URL, ...overrides};
  context.createPersonDetector = choice => createPersonDetector(choice, {cocoSsd: overrides.cocoSsd});
  context.window=context;
  vm.createContext(context);
  let source=fs.readFileSync(new URL('../js/'+file,import.meta.url),'utf8');
  if (lineEnding) source=source.replace(/\r\n|\r|\n/g,lineEnding);
  // Git may check out CRLF on Windows; normalize before matching imports and startup calls.
  source=source.replace(/\r\n?/g,'\n');
  source=source.replace(/^import[\s\S]*?;\n/gm,'');
  source=source.replace('// Initial crowd calculations\nupdateCrowdTelemetryUI();','');
  source=source.replace('// Initial triggers\nloadContacts();\nwindow.onTriageInputChange();','');
  vm.runInContext(source,context);
  return {context,nodes,document,writes,storage,commits:()=>commits,run:code=>vm.runInContext(code,context)};
}

test('Zero vision detections stay zero; repeated scans use clean pixels and explicit limits',async()=>{
  const seen=[];let predictions=[];
  const h=harness('tracker.js',{cocoSsd:{load:async()=>({detect:async(source,max,min)=>{
    seen.push([source.pixels,max,min]);return predictions;
  }})}});
  h.context.source={width:600,height:280,pixels:0};h.run('setVisionSource(source)');
  await h.context.runVisionDetection();
  assert.equal(h.document.getElementById('vision-detected-count').textContent,'0 detected');
  predictions=[{class:'person',score:.9,bbox:[10,10,30,60]}];
  await h.context.runVisionDetection();await h.context.runVisionDetection();
  assert.deepEqual(seen,[[0,200,.35],[0,200,.35],[0,200,.35]]);
  assert.equal(h.document.getElementById('vision-detected-count').textContent,'1 detected');
  assert.match(h.document.getElementById('vision-density').textContent, /unavailable/);
});
test('Model failures produce unavailable status instead of artificial people',async()=>{
  const h=harness('tracker.js',{cocoSsd:{load:async()=>{throw Error('offline')}}});
  h.context.source={width:600,height:280,pixels:0};h.run('setVisionSource(source)');
  await h.context.runVisionDetection();
  assert.equal(h.document.getElementById('vision-detected-count').textContent,'Unavailable');
  assert.equal(h.document.getElementById('btn-run-vision-scan').disabled,false);
});
test('New image supersedes an in-flight detection without displaying stale counts',async()=>{
  let release;let calls=0;
  const h=harness('tracker.js',{cocoSsd:{load:async()=>({detect:async()=>{
    calls++; if(calls===1) return new Promise(r=>{release=r});return [];
  }})}});
  h.context.source={width:600,height:280,pixels:0};h.run('setVisionSource(source)');
  const pending=h.context.runVisionDetection();await new Promise(r=>setImmediate(r));
  h.run('setVisionSource(source)');release([{class:'person',score:.9,bbox:[1,1,10,10]}]);
  await pending;await new Promise(r=>setImmediate(r));
  assert.equal(h.document.getElementById('vision-detected-count').textContent,'0 detected');
});
function assessment(h){h.run(`currentTriageAssessment = {triageId:'request-1',priority:'UNKNOWN',priorityLabel:'Review',conditionTitle:'Unknown',firstAidSteps:[],timestamp:new Date().toISOString()}`);}
test('GPS denied still records unknown location, with atomic idempotent database IDs',async()=>{
  const h=harness('safety.js');assessment(h);
  await h.context.dispatchEmergencySOS();await h.context.dispatchEmergencySOS();
  assert.equal(h.commits(),2);
  assert.equal(h.writes[0].payload.coordinates,null);
  assert.equal(h.writes[0].payload.etaMinutes,null);
  assert.equal(h.writes[0].path,h.writes[2].path);
  assert.match(h.document.getElementById('dispatch-details').textContent,/No ambulance or PHC has been contacted/);
});
test('Database rejection never displays a successful storage or dispatch confirmation',async()=>{
  const h=harness('safety.js',{writeBatch(){return {set(){},commit:async()=>{throw Error('permission-denied')}}}});assessment(h);
  await h.context.dispatchEmergencySOS();
  assert.match(h.document.getElementById('dispatch-details').textContent,/not confirmed/);
  assert.equal(h.document.getElementById('dispatch-sos-btn').disabled,false);
  assert.ok(h.storage.getItem('exploreguard.pending.test-user.request-1'));
});
test('Pending database write times out honestly; late acknowledgement clears local copy',async()=>{
  let resolveCommit;
  const h=harness('safety.js',{setTimeout(fn,ms){return setTimeout(fn,ms===12000?5:ms)},
    writeBatch(){return {set(){},commit:()=>new Promise(r=>{resolveCommit=r})}}});assessment(h);
  await h.context.dispatchEmergencySOS();
  assert.match(h.document.getElementById('dispatch-details').textContent,/confirmation pending/);
  resolveCommit();await new Promise(r=>setImmediate(r));
  assert.equal(h.storage.getItem('exploreguard.pending.test-user.request-1'),null);
});

for (const lineEnding of ['\n', '\r\n']) {
  test(`Controllers load with ${lineEnding === '\n' ? 'LF' : 'CRLF'} line endings`, () => {
    for (const file of ['tracker.js', 'safety.js']) {
      assert.doesNotThrow(() => harness(file, {}, lineEnding));
    }
  });
}

test('Medical report does not assign priority or a facility from keywords or invented vitals', async () => {
  const h = harness('safety.js');
  h.document.getElementById('triage-symptoms-text').value = 'core temperature 40.5C, delirious';
  await h.context.onTriageInputChange();
  assert.equal(h.run('currentTriageAssessment.priority'), 'UNKNOWN');
  assert.equal(h.run('currentTriageAssessment.recommendedFacility'), null);
  assert.equal(h.run('currentTriageAssessment.vitalsRecorded.pulseRate'), null);
  assert.equal(h.run('currentTriageAssessment.vitalsRecorded.severeBleeding'), 'unknown');
  assert.match(h.document.getElementById('triage-distance-text').textContent, /unavailable/);
});
test('Missing Gemini key and provider failure leave the report unassessed', async () => {
  const h = harness('safety.js', {fetch: async () => ({ok:false, status:429})});
  h.document.getElementById('triage-symptoms-text').value = 'fictional report';
  await h.context.onTriageInputChange(true);
  assert.match(h.document.getElementById('triage-ai-model-tag').textContent, /configure a Gemini key/);
  h.storage.setItem('gemini_api_key', 'test-key');
  await h.context.onTriageInputChange(true);
  assert.equal(h.run('currentTriageAssessment.priority'), 'UNKNOWN');
  assert.match(h.document.getElementById('triage-ai-model-tag').textContent, /unavailable/);
});
test('Gemini summary includes entered observations and stale responses cannot overwrite edits', async () => {
  let release, sent;
  const h = harness('safety.js', {fetch: async (url, options) => {
    sent = JSON.parse(options.body);
    return new Promise(resolve => {release = resolve;});
  }});
  h.storage.setItem('gemini_api_key','test-key');
  h.document.getElementById('triage-symptoms-text').value = 'fictional first report';
  h.document.getElementById('triage-pulse').value = '83';
  const pending = h.context.onTriageInputChange(true);
  assert.match(sent.contents[0].parts[0].text, /"pulseRate":83/);
  h.document.getElementById('triage-symptoms-text').value = 'edited report';
  await h.context.onTriageInputChange();
  release({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({summary:'old summary'})}]}}]})});
  await pending;
  assert.equal(h.run('currentTriageAssessment.localizedSummary'),null);
  assert.equal(h.run('currentTriageAssessment.symptomsDescription'),'edited report');
});
test('Weather and elevation failures never substitute preset readings or probabilities', async () => {
  const h = harness('alerts.js', {fetch:async()=>({ok:false,status:503})});
  await h.context.loadEnvironment({lat:0,lon:0,name:'Equator'});
  assert.equal(h.document.getElementById('weather-temperature').textContent,'Unavailable');
  assert.equal(h.document.getElementById('terrain-slope').textContent,'Unavailable');
  assert.match(h.document.getElementById('weather-source').textContent,/No substitute/);
});
test('Provider readings preserve precipitation interval and partial terrain failures', async () => {
  const h = harness('alerts.js', {fetch:async url => url.includes('/elevation')
    ? {ok:false,status:503}
    : {ok:true,json:async()=>({current:{time:'2026-10-30T12:00',temperature_2m:20,relative_humidity_2m:70,wind_speed_10m:12,surface_pressure:990,precipitation:0,interval:900}})}
  });
  await h.context.loadEnvironment({lat:24,lon:94,name:'Test location'});
  assert.equal(h.document.getElementById('weather-rain').textContent,'0.0 mm / 15 min');
  assert.equal(h.document.getElementById('terrain-slope').textContent,'Unavailable');
  assert.match(h.document.getElementById('weather-source').textContent,/2026-10-30T12:00 UTC/);
});
test('A valid AI summary never changes clinical priority or assigns a responder', async () => {
  const h = harness('safety.js', {fetch:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({summary:'Fictional report supplied by the user.'})}]}}]})})});
  h.storage.setItem('gemini_api_key','test-key');
  h.document.getElementById('triage-symptoms-text').value = 'Fictional report';
  await h.context.onTriageInputChange(true);
  assert.equal(h.run('currentTriageAssessment.localizedSummary'),'Fictional report supplied by the user.');
  assert.equal(h.run('currentTriageAssessment.priority'),'UNKNOWN');
  assert.equal(h.run('currentTriageAssessment.recommendedFacility'),null);
});

const forecastDate = new Date().toISOString().slice(0,10);
const riverResponse = values => ({latitude:25.575,longitude:91.875,daily_units:{river_discharge:'m³/s'},daily:{time:values.map((_,i)=>new Date(Date.parse(forecastDate+'T00:00:00Z')+i*86400000).toISOString().slice(0,10)),river_discharge:values}});
test('River forecast preserves zero/missing days and labels partial output', async () => {
  const h=harness('alerts.js',{fetch:async url=>url.includes('flood-api')?{ok:true,json:async()=>riverResponse([0,null,3])}:{ok:false,status:503}});
  await h.context.loadEnvironment({lat:25,lon:91,name:'Test location'});
  await h.context.loadRiverForecast();
  const rows=h.document.getElementById('river-rows').children;
  assert.equal(rows[0].children[1].textContent,'0');
  assert.equal(rows[1].children[1].textContent,'Unavailable');
  assert.match(h.document.getElementById('river-status').textContent,/Partial/);
  assert.match(h.document.getElementById('river-summary').textContent,/not a flood severity/);
});
test('A changed location invalidates pending river forecasts', async () => {
  let release;
  const h=harness('alerts.js',{fetch:async url=>url.includes('flood-api')?new Promise(resolve=>{release=resolve}):{ok:false,status:503}});
  await h.context.loadEnvironment({lat:25,lon:91,name:'Old place'});
  const pending=h.context.loadRiverForecast();
  await h.context.loadEnvironment({lat:26,lon:92,name:'New place'});
  release({ok:true,json:async()=>riverResponse([50,60])});await pending;
  assert.equal(h.document.getElementById('river-result').hidden,true);
  assert.equal(h.document.getElementById('location-result').textContent,'New place');
});
test('Search presents alternatives without automatically loading the first city', async () => {
  const h=harness('alerts.js',{fetch:async()=>({ok:true,json:async()=>({results:[{name:'Springfield',country:'A',latitude:20,longitude:40},{name:'Springfield',country:'B',latitude:30,longitude:50}]})})});
  h.document.getElementById('city-input').value='Springfield';
  await h.context.loadEnvironment();
  assert.equal(h.document.getElementById('location-choices').children.length,2);
  assert.equal(h.run('currentLocation'),null);
});
test('Failed river provider request leaves no forecast or safe classification', async () => {
  const h=harness('alerts.js',{fetch:async()=>({ok:false,status:503})});
  await h.context.loadEnvironment({lat:25,lon:91,name:'Test location'});
  await h.context.loadRiverForecast();
  assert.equal(h.document.getElementById('river-result').hidden,true);
  assert.match(h.document.getElementById('river-status').textContent,/unavailable/);
  assert.equal(h.document.getElementById('load-river-button').disabled,false);
});

test('Gemini errors distinguish rejected keys, restrictions, quota, missing models and outages without exposing raw text', async () => {
  for (const [status,message,expected] of [[400,'API key not valid. secret-value',/rejected the API key/],[403,'secret-value',/denied access/],[429,'secret-value',/quota or rate limit/],[404,'secret-value',/Model unavailable/],[503,'secret-value',/service error/]]) {
    const h=harness('safety.js',{fetch:async()=>({ok:false,status,json:async()=>({error:{message}})})});
    h.storage.setItem('gemini_api_key','secret-value');
    h.document.getElementById('triage-symptoms-text').value='Fictional report';
    await h.context.onTriageInputChange(true);
    const text=h.document.getElementById('triage-ai-model-tag').textContent;
    assert.match(text,expected); assert.doesNotMatch(text,/secret-value/);
    assert.equal(h.run('currentTriageAssessment.priority'),'UNKNOWN');
  }
});
test('Connection test uses entered credentials/model and a test prompt, never the incident or database',async()=>{
  let request;
  const h=harness('safety.js',{fetch:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'OK'}]}}]})};}});
  h.document.getElementById('gemini-triage-key-input').value='test-only-key';
  h.document.getElementById('gemini-model-input').value='gemini-test-model';
  h.document.getElementById('triage-symptoms-text').value='Private incident must not be sent';
  await h.context.testGeminiConnection();
  assert.match(request.url,/gemini-test-model:generateContent$/);
  assert.equal(request.options.headers['x-goog-api-key'],'test-only-key');
  assert.doesNotMatch(request.options.body,/Private incident/);
  assert.equal(h.commits(),0);assert.equal(h.storage.getItem('gemini_api_key'),null);
  assert.match(h.document.getElementById('gemini-settings-status').textContent,/test passed/);
});
test('Saving settings does not claim verification or send a request',()=>{
  const h=harness('safety.js',{fetch:()=>{throw Error('Unexpected request')}});
  h.document.getElementById('gemini-triage-key-input').value='test-key';
  h.document.getElementById('gemini-model-input').value='gemini-test-model';
  h.context.saveGeminiKey();
  assert.equal(h.storage.getItem('gemini_model'),'gemini-test-model');
  assert.match(h.document.getElementById('gemini-settings-status').textContent,/not verified/);
});
test('Connection timeout and blocked response show useful errors, and re-enable test button',async()=>{
  for(const failure of ['timeout','blocked']) {
    const h=harness('safety.js',{fetch:async()=>{if(failure==='timeout'){const e=new Error();e.name='TimeoutError';throw e;}return {ok:true,json:async()=>({promptFeedback:{blockReason:'SAFETY'}})}}});
    h.document.getElementById('gemini-triage-key-input').value='test-key';
    h.document.getElementById('gemini-model-input').value='gemini-test-model';
    await h.context.testGeminiConnection();
    assert.match(h.document.getElementById('gemini-settings-status').textContent,failure==='timeout'?/30 seconds/:/blocked/);
    assert.equal(h.document.getElementById('gemini-test-btn').disabled,false);
  }
});

test('Model discovery follows pagination and offers only provider-returned generation models',async()=>{
  const urls=[];
  const h=harness('safety.js',{fetch:async(url,options)=>{
    urls.push(url);assert.equal(options.headers['x-goog-api-key'],'local-test-key');
    return {ok:true,json:async()=>urls.length===1?{models:[{name:'models/text-a',supportedGenerationMethods:['generateContent']},{name:'models/embedding-a',supportedGenerationMethods:['embedContent']}],nextPageToken:'next'}:{models:[{name:'models/text-b',supportedGenerationMethods:['generateContent']}]}};
  }});
  h.document.getElementById('gemini-triage-key-input').value='local-test-key';
  await h.context.loadGeminiModels();
  assert.equal(urls.length,2);assert.match(urls[1],/pageToken=next/);
  assert.deepEqual(h.document.getElementById('gemini-model-select').children.map(x=>x.value),['','text-a','text-b']);
  assert.equal(h.document.getElementById('gemini-model-select').value,'');
  assert.equal(h.storage.getItem('gemini_model'),null);
});
test('Model list fails honestly and ignores results for an edited key',async()=>{
  let release;
  const h=harness('safety.js',{fetch:()=>new Promise(r=>{release=r})});
  h.document.getElementById('gemini-triage-key-input').value='first';
  const pending=h.context.loadGeminiModels();
  h.document.getElementById('gemini-triage-key-input').value='second';h.context.invalidateGeminiModels();
  release({ok:true,json:async()=>({models:[{name:'models/old',supportedGenerationMethods:['generateContent']}]})});
  await pending;
  assert.equal(h.document.getElementById('gemini-model-select').children.length,0);
  assert.equal(h.document.getElementById('gemini-model-select').disabled,true);
  const failed=harness('safety.js',{fetch:async()=>({ok:false,status:403})});
  failed.document.getElementById('gemini-triage-key-input').value='test-key';
  await failed.context.loadGeminiModels();
  assert.match(failed.document.getElementById('gemini-settings-status').textContent,/denied access/);
  assert.equal(failed.document.getElementById('gemini-model-select').disabled,true);
});
