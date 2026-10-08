/* global globalThis */
import { Buffer } from "node:buffer";
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import assert from 'node:assert/strict';
let source = await readFile('app/scan.server.ts', 'utf8');
source = source.replace(/import prisma from .*?;/, 'const prisma = {};').replace(/import \{ getOpenAIKey, selectedProvider \} from .*?;/, 'const getOpenAIKey = () => null; const selectedProvider=()=>"openai";').replace(/import \{ loadQuiz, loadStoreProducts \} from .*?;/, 'const loadQuiz=()=>null; const loadStoreProducts=()=>[];');
const code = await transform(source, { loader: 'ts', format: 'esm' });
const { analysePhoto, scanResult, recommendScanProducts } = await import('data:text/javascript;base64,' + Buffer.from(code.code).toString('base64'));
const catalog = [{title:'Saffron Glow Serum',handle:'saffron-glow-serum'},{title:'Bakuchiol Night Restorative Serum',handle:'bakuchiol-night-restorative-serum'},{title:'Gift Card',handle:'gift-card'}];
assert.deepEqual(recommendScanProducts(['dullness'],[{tags:['normal_or_balanced'],productHandle:'gift-card'}],catalog).map(p=>p.handle),['saffron-glow-serum']);
assert.deepEqual(recommendScanProducts(['fine_lines'],[],catalog).map(p=>p.handle),['bakuchiol-night-restorative-serum']);
assert.equal(recommendScanProducts([],[],catalog).length,0);
let calls=0;
globalThis.fetch=async(url,options)=>{calls++; assert.equal(JSON.parse(options.body).store,false); return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({usable:true,summary:'Visible uneven tone.',concerns:[{concern:'pigmentation',observation:'Uneven tone.',regions:['cheeks','cheeks'],intensity:'moderate'},{concern:'pigmentation',observation:'Duplicate.',regions:['nose'],intensity:'mild'}]})}]}]})};};
const mapped = await analysePhoto('data:image/jpeg;base64,YWJj','dummy');
assert.equal(mapped.concerns[0].concern,'pigmentation');
// Duplicate concerns and repeated regions are collapsed.
assert.equal(mapped.concerns.length,1);
assert.deepEqual(mapped.concerns[0].regions,['cheeks']);
await assert.rejects(()=>analysePhoto('invalid','dummy'),/Upload/);
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
console.log('Passed: scan recommendations, consent validation, structured response parsing and API errors. External calls mocked.');

const { landmarkPose, frameCheck, guideOval, sharpness } = await import('../app/face-scan.js');
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
assert.match(frame({ faces: 0 }).message, /Position/);
assert.match(frame({ faces: 2 }).message, /one face/);
assert.match(frame({ light: 10 }).message, /dark/);
assert.match(frame({ yaw: 0.8 }).message, /straight/);
assert.match(frame({ box: { minX: 300, maxX: 340, minY: 200, maxY: 250 } }).message, /closer/);
assert.match(frame({ box: { minX: 0, maxX: 640, minY: 0, maxY: 480 } }).message, /back/);
assert.match(frame({ box: { ...centred, minX: centred.minX - 150, maxX: centred.maxX - 150 } }).message, /Center/);
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

