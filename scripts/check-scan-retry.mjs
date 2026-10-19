import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile('app/storefront-quiz.js','utf8')).replaceAll('\r\n','\n');
const start=source.indexOf('    function finishScan(images) {');
const end=source.indexOf('    function saveEmail()',start);
assert.ok(start>=0&&end>start);
for(const succeeded of [false,true]) {
 let overlayHidden=false, cleared=0, submissions=0;
 const preview={style:{},removeAttribute(){cleared++;}};
 const file={value:'selected'};
 const zone={classList:{remove(){}}};
 const overlay={};
 const env={scanPreparing:false,submitting:false,scanMode:'upload',scanPhoto:null,scanLandmarks:null,scanMirrored:false,captured:'photo',removed:false,
 stopCamera(){},startCamera(){},showAnalyzing(){},hideAnalyzing(){overlayHidden=true;},consentGiven:()=>true,
 checkPhoto:async()=>null,compactScanPhoto:async()=> 'photo',submit:async()=>{submissions++;return succeeded;},setTimeout(){},
 q:s=>s==='[data-analyzing]'?overlay:s==='[data-upload-preview]'?preview:s==='[data-file]'?file:s==='[data-upload-zone]'?zone:{}};
 new Function('env','with(env){'+source.slice(start,end)+';finishScan("photo");finishScan("photo");}')(env);
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(overlayHidden,true);
 assert.equal(submissions,1);assert.equal(env.scanPreparing,false);
 assert.equal(env.captured,succeeded?null:'photo');
 assert.equal(cleared,succeeded?1:0);
 assert.equal(file.value,succeeded?'':'selected');
}
console.log('PASS: failed upload retains photo for retry; success clears it; overlay closes in both cases.');
