import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = (await readFile("app/storefront-quiz.js", "utf8")).replaceAll("\r\n", "\n");
const start = source.indexOf("    function startCamera() {");
const end = source.indexOf("    root.addEventListener(\"click\"", start);
const functions = source.slice(start,end);
let resumes = 0;
const feed = { play: () => { resumes++; return Promise.resolve(); } };
const status = {};
const pending = [];
const env = {cameraStream: {getTracks:()=>[]}, cameraOpening:false, cameraGeneration:0, faceScan:null,
 q: selector => selector === "[data-camera-feed]" ? feed : status,
 navigator: {mediaDevices:{getUserMedia:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))}},
 createFaceScan: async()=>({close(){}}), scanMode:"camera"};
const api = new Function("env", "with(env) {"+functions+"; return {startCamera,stopCamera};}")(env);
api.startCamera(); assert.equal(resumes,1,"Existing stream resumes playback");
api.stopCamera(); api.startCamera(); assert.equal(env.cameraOpening,true);
api.stopCamera(); api.startCamera(); assert.equal(pending.length,2);
let stopped=0;
pending[0].resolve({getTracks:()=>[{stop(){stopped++;}}]});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(stopped,1,"Stale stream is released");
assert.equal(env.cameraOpening,true,"Stale success cannot clear current request flag");
pending[1].resolve({getTracks:()=>[{stop(){}}]});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(env.cameraOpening,false); assert.ok(env.cameraStream);
api.stopCamera();
console.log("PASS: blocked playback resumes; stale camera requests release streams without resetting a newer request.");
