import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {transform} from 'esbuild';
let source=(await readFile('app/routes/proxy.result.tsx','utf8')).replace(/^import .*;\r?\n/gm,'');
const compiled=await transform(source,{loader:'ts',format:'cjs'});let submission,built=0,seenEmail;
const env={Response,URL,authenticate:{public:{appProxy:async()=>({session:{shop:'a'}})}},readBoundedJson:async()=>submission,loadQuiz:async()=>({quick:[{options:[{},{}]}]}),buildQuizResult:async()=>{built++;return{};},storeReport:async()=>({reportId:'id'}),unlockReport:async(_s,_id,email)=>{seenEmail=email;return{result:{}};},recordScanHealth:async()=>{},scanFailureCategory:()=>''};
const module={exports:{}};new Function('env','module','with(env){'+compiled.code+'}')(env,module);
const call=()=>module.exports.action({request:new Request('https://example.com')});
for(const answers of [{0:0},[0,1],[],[4]]){submission={code:'123',path:'quick',answers};assert.equal((await call()).status,422);}
assert.equal(built,0);submission={code:'123',path:'quick',answers:[0],email:' User@Example.com '};assert.equal((await call()).status,200);assert.equal(built,1);assert.equal(seenEmail,'user@example.com');
console.log('PASS: result API requires an exact answer array and normalizes email whitespace/case.');
