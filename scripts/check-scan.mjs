/* global globalThis */
import { Buffer } from "node:buffer";
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import assert from 'node:assert/strict';
let source = await readFile('app/scan.server.ts', 'utf8');
source = source.replace(/import prisma from .*?;/, 'const prisma = { $executeRawUnsafe: async () => 1 };').replace(/import \{ getOpenAIKey, selectedProvider \} from .*?;/, 'const getOpenAIKey = () => "test-key"; const selectedProvider=()=>"openai";').replace(/import \{ loadQuiz, loadStoreProducts \} from .*?;/, 'const loadQuiz=()=>({enabledPaths:["scan"],mappings:[]}); const loadStoreProducts=()=>{throw new Error("Catalog unavailable");};');
const code = await transform(source, { loader: 'ts', format: 'esm' });
const { analysePhoto, scanResult, recommendScanProducts } = await import('data:text/javascript;base64,' + Buffer.from(code.code).toString('base64'));
const catalog = [{title:'Saffron Glow Serum',handle:'saffron-glow-serum'},{title:'Bakuchiol Night Restorative Serum',handle:'bakuchiol-night-restorative-serum'},{title:'Gift Card',handle:'gift-card'}];
assert.deepEqual(recommendScanProducts(['dullness'],[{tags:['normal_or_balanced'],productHandle:'gift-card'}],catalog).map(p=>p.handle),['saffron-glow-serum']);
assert.deepEqual(recommendScanProducts(['fine_lines'],[],catalog).map(p=>p.handle),['bakuchiol-night-restorative-serum']);
assert.equal(recommendScanProducts([],[],catalog).length,0);
let calls=0;
globalThis.fetch=async(url,options)=>{calls++; assert.equal(JSON.parse(options.body).store,false); assert.equal(JSON.parse(options.body).max_output_tokens,700); return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({usable:true,summary:'Visible uneven tone.',concerns:[{concern:'pigmentation',observation:'Uneven tone.',regions:['cheeks','cheeks'],intensity:'moderate'},{concern:'pigmentation',observation:'Duplicate.',regions:['nose'],intensity:'mild'}]})}]}]})};};
const mapped = await analysePhoto('data:image/jpeg;base64,YWJj','dummy');
assert.equal(mapped.concerns[0].concern,'pigmentation');
// Duplicate concerns and repeated regions are collapsed.
assert.equal(mapped.concerns.length,1);
assert.deepEqual(mapped.concerns[0].regions,['cheeks']);
await assert.rejects(()=>analysePhoto('invalid','dummy'),/Upload/);
// The response validator must accept all five concerns permitted by the provider schema.
const fiveConcerns = ['pigmentation','dryness','redness','pores','texture'].map(concern => ({concern,observation:'Visible on cheeks.',regions:['cheeks'],intensity:'mild'}));
globalThis.fetch=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({usable:true,summary:'Five visible concerns.',concerns:fiveConcerns})}]}]})});
assert.equal((await analysePhoto('data:image/jpeg;base64,YWJj','dummy')).concerns.length,5);
globalThis.fetch=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({usable:true,summary:'Too many.',concerns:[...fiveConcerns,fiveConcerns[0]]})}]}]})});
await assert.rejects(()=>analysePhoto('data:image/jpeg;base64,YWJj','dummy'),/Invalid analysis/);

await assert.rejects(()=>scanResult({consent:false},'test'),/Confirm/);
assert.equal(calls,1);
const photos = Array(5).fill('data:image/jpeg;base64,YWJj');
globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body); assert.equal(body.input[0].content.filter(item=>item.type==='input_image').length,5); return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({usable:true,summary:'Multi-angle estimate.',concerns:[]})}]}]})};};
assert.equal((await analysePhoto(photos,'dummy')).summary,'Multi-angle estimate.');
await assert.rejects(()=>analysePhoto(Array(6).fill(photos[0]),'dummy'),/Upload/);
await assert.rejects(()=>analysePhoto([photos[0],'invalid'],'dummy'),/Upload/);
globalThis.fetch=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({usable:true,summary:'Observation',concerns:[{concern:'pigmentation',observation:'Tone',regions:['left_ear'],intensity:'mild'}]})}]}]})});
await assert.rejects(()=>analysePhoto(photos[0],'dummy'),/Invalid analysis/);
globalThis.fetch=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({usable:true,summary:'Observation',concerns:[{concern:'redness',observation:'Red',regions:['cheeks'],intensity:'extreme'}]})}]}]})});
await assert.rejects(()=>analysePhoto(photos[0],'dummy'),/Invalid analysis/);
globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({error:{code:"invalid_api_key"}})});
await assert.rejects(()=>analysePhoto('data:image/jpeg;base64,YWJj','dummy'),/invalid/);

for (const payload of [null, {output:{}}, {output:[null]}]) {
 globalThis.fetch=async()=>({ok:true,json:async()=>payload});
 await assert.rejects(()=>analysePhoto('data:image/jpeg;base64,YWJj','dummy'),/Could not read the analysis/);
}
for (const parsed of [null, [], {usable:true,summary:'Test',concerns:[null]}]) {
 globalThis.fetch=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify(parsed)}]}]})});
 await assert.rejects(()=>analysePhoto('data:image/jpeg;base64,YWJj','dummy'),/Invalid analysis response/);
}
globalThis.fetch=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({usable:true,summary:'Visible texture.',concerns:[{concern:'texture',observation:'Texture on cheeks.',regions:['cheeks'],intensity:'mild'}]})}]}]})});
const savedConsoleError = console.error;
const catalogErrors = [];
let catalogFallback;
try { console.error=(...args)=>catalogErrors.push(args); catalogFallback=await scanResult({code:'test',consent:true,adult:true,image:'data:image/jpeg;base64,YWJj'},'test',{}); }
finally { console.error=savedConsoleError; }
assert.equal(catalogFallback.profile.essence,'Visible texture.');
assert.deepEqual(catalogFallback.products,[]);
assert.equal(catalogErrors[0][1].category,'catalog_fetch_failed');
console.log('Passed: scan recommendations, consent validation, structured response parsing and API errors. External calls mocked.');

const { landmarkPose, frameCheck, guideOval, sharpness, photoProblem } = await import('../app/face-scan.js');
const points = Array.from({length: 264},()=>({x:0.5,y:0.5}));
points[33]={x:0.4,y:0.4}; points[263]={x:0.6,y:0.4}; points[1]={x:0.5,y:0.5};
assert.ok(Math.abs(landmarkPose(points).yaw) < 0.01);
points[1]={x:0.56,y:0.5}; assert.ok(landmarkPose(points).yaw > 0.4);
assert.equal(landmarkPose([]),null);
// A 640x480 frame: the oval is centred and sized from the shorter side.
const oval = guideOval(640, 480);
const centred = { minX: oval.centerX - oval.radiusX * 0.8, maxX: oval.centerX + oval.radiusX * 0.8, minY: oval.centerY - oval.radiusY * 0.8, maxY: oval.centerY + oval.radiusY * 0.8 };
const frame = (extra) => frameCheck({ faces: 1, box: centred, light: 120, yaw: 0, width: 640, height: 480, ...extra });
assert.equal(frame().ok, true);
assert.match(frame({ faces: 0 }).message, /circle/);
assert.match(frame({ faces: 2 }).message, /one face/);
assert.match(frame({ light: 10 }).message, /brighter/);
assert.match(frame({ yaw: 0.8 }).message, /straight/);
assert.match(frame({ box: { minX: 300, maxX: 340, minY: 200, maxY: 250 } }).message, /closer/);
assert.match(frame({ box: { minX: 0, maxX: 640, minY: 0, maxY: 480 } }).message, /back/);
assert.match(frame({ box: { ...centred, minX: centred.minX - 150, maxX: centred.maxX - 150 } }).message, /centre/);
// The captured photo is rejected when a hand covers the face, there is no face or several, or the head is turned.
const facePts = Array.from({ length: 468 }, (_, i) => ({ x: 0.4 + (i % 20) * 0.01, y: 0.3 + Math.floor(i / 20) * 0.017 }));
facePts[33] = { x: 0.45, y: 0.4 }; facePts[263] = { x: 0.55, y: 0.4 }; facePts[1] = { x: 0.5, y: 0.5 };
const handOn = Array.from({ length: 21 }, (_, i) => ({ x: 0.42 + i * 0.005, y: 0.5 }));
const handAway = Array.from({ length: 21 }, (_, i) => ({ x: 0.05 + i * 0.005, y: 0.9 }));
assert.equal(photoProblem({ faces: 1, points: facePts, hands: [handAway] }), null);
assert.match(photoProblem({ faces: 1, points: facePts, hands: [handOn] }), /hands/);
assert.match(photoProblem({ faces: 0, points: null, hands: [] }), /could not find/);
assert.match(photoProblem({ faces: 2, points: facePts, hands: [] }), /one face/);
const turned = facePts.slice(); turned[1] = { x: 0.6, y: 0.5 };
assert.match(photoProblem({ faces: 1, points: turned, hands: [] }), /straight/);
// Sharpness prefers a detailed frame over a flat (blurred) one.
const flat = new Uint8ClampedArray(16 * 16 * 4).fill(128);
const edges = new Uint8ClampedArray(16 * 16 * 4).map((_, i) => ((Math.floor(i / 4) % 2) ? 255 : 0));
assert.ok(sharpness(edges, 16, 16) > sharpness(flat, 16, 16));
console.log('Passed: single-shot face guidance, framing checks and sharpest-frame selection.');

// Skin map circles are placed from landmarks on the face, scaled to the eye span.
const { regionCircles } = await import('../app/face-scan.js');
const face = Array.from({length: 478}, () => ({ x: 0.5, y: 0.5 }));
Object.assign(face, { 33: {x:0.4,y:0.4}, 263: {x:0.6,y:0.4}, 9: {x:0.5,y:0.38}, 10: {x:0.5,y:0.2}, 50: {x:0.38,y:0.55}, 280: {x:0.62,y:0.55}, 145: {x:0.42,y:0.43}, 234: {x:0.25,y:0.45}, 454: {x:0.75,y:0.45}, 374: {x:0.58,y:0.43}, 17: {x:0.5,y:0.68}, 152: {x:0.5,y:0.78} });
const forehead = regionCircles(face, 1000, 1000, 'forehead');
assert.equal(forehead.length, 1);
assert.ok(forehead[0].y < 380 && forehead[0].y > 200, 'forehead sits between brows and hairline');
assert.equal(regionCircles(face, 1000, 1000, 'cheeks').length, 2);
const [leftCheek, rightCheek] = regionCircles(face, 1000, 1000, 'cheeks');
assert.ok(leftCheek.x < 500 && rightCheek.x > 500);
assert.ok(Math.abs(leftCheek.r - 200 * 0.24) < 0.01, 'radius scales with eye span');
assert.ok(leftCheek.x < 380 && rightCheek.x > 620, 'cheeks sit outside the inner cheek points');
assert.ok(regionCircles(face, 1000, 1000, 'under_eyes').every(c => c.y > 430));
assert.ok(regionCircles(face, 1000, 1000, 'chin')[0].y > 680);
assert.deepEqual(regionCircles(face, 1000, 1000, 'unknown'), []);
assert.deepEqual(regionCircles([], 1000, 1000, 'cheeks'), []);
console.log('Passed: skin map regions are placed on the face from landmarks.');


const {isSeverelyBlurred}=await import('../app/face-scan.js');
const flatPixels=new Uint8ClampedArray(16*16*4).fill(128);
assert.equal(isSeverelyBlurred(flatPixels,16,16),true);
const detailPixels=new Uint8ClampedArray(16*16*4);
for(let y=0;y<16;y++)for(let x=0;x<16;x++){const v=(x+y)%2?255:0;const i=(y*16+x)*4;detailPixels[i]=detailPixels[i+1]=detailPixels[i+2]=v;detailPixels[i+3]=255;}
assert.equal(isSeverelyBlurred(detailPixels,16,16),false);
console.log('PASS: detail-free images reject; sharp image detail is retained.');

// Rotating a front-facing photo in its own plane must not create false yaw.
const upright=Array.from({length:264},()=>({x:0.5,y:0.5}));
upright[33]={x:0.4,y:0.4};upright[263]={x:0.6,y:0.4};upright[1]={x:0.5,y:0.52};
for(const angle of [-0.6,0.6]) {
 const rotated=upright.map(p=>({x:0.5+(p.x-0.5)*Math.cos(angle)-(p.y-0.5)*Math.sin(angle),y:0.5+(p.x-0.5)*Math.sin(angle)+(p.y-0.5)*Math.cos(angle)}));
 assert.ok(Math.abs(landmarkPose(rotated).yaw)<0.001);
 assert.equal(photoProblem({faces:1,points:rotated,hands:[]}),null);
}
console.log('PASS: tilted front-facing photos are not mistaken for sideways faces.');
