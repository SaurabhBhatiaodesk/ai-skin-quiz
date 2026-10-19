import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
const source=await readFile('app/components/useQuizDraft.ts','utf8');
const compiled=await transform(source,{loader:'ts',format:'cjs'});
function scenario(stored){
 const store=new Map(stored?[['quiz-draft:shop:123',JSON.stringify(stored)]]:[]);const effects=[];let recovery=null;
 const react={useState:()=>[null,v=>{recovery=v;}],useRef:()=>({current:false}),useEffect:f=>effects.push(f)};
 const module={exports:{}};
 new Function('require','module','exports','localStorage',compiled.code)(()=>react,module,module.exports,{getItem:k=>store.get(k),removeItem:k=>store.delete(k),setItem:(k,v)=>store.set(k,v)});
 const saved={quick:[],deep:[]};const api=module.exports.default('shop','123',saved,saved);effects[0]();return {recovery,store,api};
}
const base=JSON.stringify({quick:[],deep:[]});const quiz={quick:[{text:'Draft'}],deep:[]};
assert.deepEqual(scenario({version:1,updatedAt:Date.now(),base,quiz}).recovery,quiz);
assert.equal(scenario({version:1,updatedAt:Date.now()-8*86400000,base,quiz}).recovery,null);
assert.equal(scenario({version:1,updatedAt:Date.now(),base:'older saved version',quiz}).store.size,0);
const restored=scenario({version:1,updatedAt:Date.now(),base,quiz});restored.api.dismiss();assert.equal(restored.store.size,0);
console.log('PASS: widget-scoped draft recovery rejects expired/stale drafts and supports discard.');
