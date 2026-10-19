import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (await readFile('app/face-scan.js','utf8')).replaceAll('\r\n','\n');
const start = source.indexOf('  async function capture() {');
const end = source.indexOf('\n\n  tick();',start);
const capture = source.slice(start,end).trim();
function scenario(visible) {
 let now=0, closed=false;
 const env={HOLD_MS:1400,takeStill:async()=>null,facePoints:null,performance:{now:()=>now},readySince:1,lastCheck:{message:'Position your face'},instruction:{},hint:{},countdown:{},onStatus:()=>{},disposed:false,
  assertActive(){if(closed)throw new Error('cancelled');},freshFace:()=>visible && now<900,
  wait:async(ms)=>{now+=ms;},flash:async()=>{},verified:async(images)=>images,grabFrame:()=>({score:1,canvas:{toDataURL:()=> 'image'}})};
 return {run:()=>new Function('env', 'with(env) { return ('+capture+')(); }')(env), close:()=>{closed=true;},time:()=>now};
}
const missing=scenario(false); await assert.rejects(missing.run(),/clearly|steady/); assert.ok(missing.time()<=20200);
const moving=scenario(true); await assert.rejects(moving.run(),/clearly|steady/); assert.ok(moving.time()<=20200);
const cancelled=scenario(false);cancelled.close();await assert.rejects(cancelled.run(),/cancelled/);
console.log('PASS: missing face and interrupted hold-to-scan terminate within total deadline; cancellation rejects.');

// Closing the camera while photo verification is pending must discard that capture.
const verifiedStart = source.indexOf('  async function verified(images) {');
const verifiedEnd = source.indexOf('  async function capture()',verifiedStart);
const verifiedSource = source.slice(verifiedStart,verifiedEnd).trim();
let closeDuringCheck = false;
const verificationEnv = {instruction:{},onStatus(){},readySince:1,sideViews:async(images)=>images,checkPhoto:async()=>{closeDuringCheck=true;return {points:[]};},wait:()=>new Promise(()=>{}),assertActive(){if(closeDuringCheck)throw new Error('Scan cancelled');}};
await assert.rejects(new Function('env','with(env){ return ('+verifiedSource+')(["image"]); }')(verificationEnv),/cancelled/);
console.log('PASS: a camera closed during photo verification cannot return a captured photo.');

// Side photos: one instruction; a turn to each side adds one photo; with no turn the scan moves on within the limit.
const sideStart = source.indexOf('  async function sideViews(images) {');
const sideEnd = source.indexOf('  // The photo itself is checked before it is sent', sideStart);
const sideSource = source.slice(sideStart, sideEnd).trim();
function sideScenario(yawAt) {
  let now = 0;
  const env = { performance: { now: () => now }, disposed: false, assertActive() {}, instruction: {}, onStatus() {},
    get checkedAt() { return now; }, lastFaces: 1, get lastYaw() { return yawAt(now); },
    grabFrame: () => ({ canvas: { toDataURL: () => 'side' } }), wait: async (ms) => { now += ms; } };
  return new Function('env', 'with(env){ return (' + sideSource + ')(Object.assign(["front"], { landmarks: [] })); }')(env).then((images) => ({ images, now }));
}
const turned = await sideScenario((t) => (t < 1000 ? 0 : t < 2000 ? 0.5 : -0.5));
assert.deepEqual([...turned.images], ['front', 'side', 'side']);
const still = await sideScenario(() => 0);
assert.deepEqual([...still.images], ['front']);
assert.ok(still.now <= 7100);
console.log('PASS: left and right photos are taken on a turn, and a shopper who does not turn is not stuck.');
