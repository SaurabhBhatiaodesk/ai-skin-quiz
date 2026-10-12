import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
const source=(await readFile('app/routes/proxy.quiz.tsx','utf8')).replace(/^import .*;\r?\n/gm,'');
const compiled=await transform(source,{loader:'ts',format:'cjs'});
const library=[{handle:'111',layout:'single',design:{accent:'#123456'}},{handle:'222',layout:'single',design:{accent:'#654321'}},{handle:'333',layout:'scan'}];
const env={authenticate:{public:{appProxy:async()=>({session:{shop:'test'}})}},loadLibrary:async()=>library,publicQuiz:async(_shop,code)=>library.find(q=>q.handle===code),quizCode:value=>value,selectedProvider:async()=> 'openai',hasOpenAIKey:async()=>true,loadScanAppearance:async()=>({}),PROVIDER_NAMES:{openai:'OpenAI'},Response,URL};
const module={exports:{}};
new Function('env','module','with(env){'+compiled.code+'}')(env,module);
const call=(query)=>module.exports.loader({request:new Request('https://store.example/apps/dosha-quiz/quiz?'+query)});
for(const code of ['111','222']){const response=await call('layout=single&code='+code);assert.equal(response.status,200);const data=await response.json();assert.equal(data.handle,code);assert.deepEqual(data.design,library.find(q=>q.handle===code).design);}
for(const query of ['layout=single','layout=single&code=dosha-quiz','layout=single&code=deleted','layout=scan&code=111','layout=scan'])assert.equal((await call(query)).status,404,query);
assert.equal((await call('layout=scan&floating=1')).status,200);
assert.equal((await call('layout=scan&floating=1&code=deleted')).status,404);
console.log('PASS: each block loads its exact widget and design; missing, deleted, and wrong-layout IDs cannot select another widget.');
