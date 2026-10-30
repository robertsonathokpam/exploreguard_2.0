import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../js/risk-engine.js';

// Runs the real page controller with isolated DOM, model and database adapters.
// It does not contact production Firebase or claim model-accuracy validation.
function harness(file, overrides = {}) {
  const nodes = new Map();
  const element = () => ({textContent:'', innerHTML:'', value:'', checked:false, disabled:false,
    style:{}, classList:{add(){},remove(){}}, setAttribute(){}, addEventListener(){},
    width:600,height:280, pixels:0,
    getContext(){ const owner=this; return {drawImage(src){owner.pixels=src.pixels ?? 0;},
      strokeRect(){owner.pixels++;},fillRect(){},fillText(){},measureText(){return {width:80};}}; }
  });
  const document = {getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},
    createElement:element,querySelector(){return element();},querySelectorAll(){return []}};
  const storage={getItem(k){return this[k]??null},setItem(k,v){this[k]=v},removeItem(k){delete this[k]}};
  let commits=0; const writes=[];
  const context={...engine,document,console:{log(){},warn(){}},performance,crypto,
    localStorage:storage,navigator:{},location:{origin:'http://localhost'},lucide:{createIcons(){}},
    auth:{},db:{},onAuthStateChanged(a,fn){fn({uid:'test-user',email:'test@example.invalid'});},
    doc(db,collection,id){return collection+'/'+id},
    writeBatch(){return {set(path,payload){writes.push({path,payload})},commit(){commits++;return Promise.resolve();}}},
    setDoc(){return Promise.resolve()},deleteDoc(){return Promise.resolve()},
    alert(){},setTimeout,clearTimeout,AbortSignal,URL, ...overrides};
  context.window=context;
  vm.createContext(context);
  let source=fs.readFileSync(new URL('../js/'+file,import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'');
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
  assert.equal(h.run('activeCustomHeadcount'),null);
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
