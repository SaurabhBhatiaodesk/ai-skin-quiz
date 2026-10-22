import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile('app/storefront-quiz.js','utf8');
const parsed=ts.createSourceFile('runtime.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
for(const path of ['quick','deep']) {
  let branch;
  function find(node){if(ts.isIfStatement(node)&&node.expression.getText(parsed)===`origin.closest("[data-${path}-next]")`)branch=node.getText(parsed);ts.forEachChild(node,find);}
  find(parsed);
  assert.ok(branch && branch.includes('submitWithEmail'));
  for(const count of [1,3,18]) {
    const answers=Object.fromEntries(Array.from({length:count},(_,i)=>[i,i%2]));
    let submitted;
    const env={origin:{closest:()=>true},quiz:{quick:Array(count).fill({}),deep:Array(count).fill({})},submitting:false,
      quickAnswers:answers,deepAnswers:answers,quickStep:count-1,deepStep:count-1,clearErrors(){},submitWithEmail(value){submitted=value;}};
    new Function('env',`with(env){${branch}}`)(env);
    assert.deepEqual(submitted,{path,answers:Object.values(answers)});
    submitted=undefined;env.submitting=true;
    new Function('env',`with(env){${branch}}`)(env);
    assert.equal(submitted,undefined,'Pending submission must not be sent twice');
  }
}
const start=source.indexOf('    function saveEmail()');
const end=source.indexOf('    root.addEventListener("change"',start);
for(const mode of ['queued','timeout','failed','invalid']) {
  const attrs={};let timer,cleared=false,painted=false;
  const confirm={textContent:'',setAttribute(k,v){attrs[k]=v;},classList:{add(){}}};
  const button={disabled:false};
  const input={value:'user@example.com'};
  let reject;
  const env={reportId:'report',PROXY:'/apps/dosha-quiz',AbortController,
    q:s=>s==='[data-email]'?input:s==='[data-email-confirm]'?confirm:button,
    setTimeout(fn){timer=fn;return 1;},clearTimeout(){cleared=true;},paintResult(){painted=true;},
    fetch:(_url,options)=>mode==='timeout'?new Promise((_resolve,no)=>{reject=no;options.signal.addEventListener('abort',()=>no(Object.assign(new Error('aborted'),{name:'AbortError'})));}):Promise.resolve({ok:true,json:async()=>mode==='invalid'?{}:({result:{},delivery:mode})})};
  const save=new Function('env',`with(env){${source.slice(start,end)};return saveEmail;}`)(env);
  save();assert.equal(button.disabled,true);
  if(mode==='timeout')timer();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(button.disabled,false);assert.equal(cleared,true);
  if(mode==='queued'){assert.equal(painted,true);assert.match(confirm.textContent,/queued/);}
  if(mode==='timeout'){assert.equal(painted,false);assert.match(confirm.textContent,/too long/);}
  if(mode==='failed')assert.match(confirm.textContent,/try again/);
  if(mode==='invalid'){assert.equal(painted,false);assert.equal(attrs['data-delivery'],'error');}
}
console.log('PASS: Quick/Deep submission contracts (1/3/18 questions), duplicate guards, and email queued/failure/timeout recovery.');
