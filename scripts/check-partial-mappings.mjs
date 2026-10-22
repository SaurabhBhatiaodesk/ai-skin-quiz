import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
const source = await readFile('app/quiz.server.ts', 'utf8');
const start = source.indexOf('function optionForAnswer');
const end = source.indexOf('export function ritualProducts', start);
const {code} = await transform(source.slice(start,end), {loader:'ts'});
const {chosenTags,mappedProducts} = new Function(`${code};return {chosenTags,mappedProducts};`)();
const quiz={quick:['dry','redness','weekly'].map(tag=>({options:[{tags:[tag]}]})),deep:[]};
const mappings=[{tags:['dry'],productHandle:'cream'},{tags:['redness'],productHandle:'serum'}];
const products=['cream','serum','unmapped'].map(handle=>({handle,title:handle,price:'10',image:''}));
const tags=chosenTags(quiz,{path:'quick',answers:[0,0,0]});
assert.deepEqual(mappedProducts(tags,mappings,products).map(p=>p.handle),['cream','serum']);
assert.deepEqual(mappedProducts(tags,mappings.slice(0,1),products).map(p=>p.handle),['cream']);
assert.deepEqual(mappedProducts(tags,[],products),[]);
const runtime = await readFile('app/storefront-quiz.js','utf8');
const branchStart=runtime.indexOf('      if (origin.closest("[data-quick-next]"))');
const branchEnd=runtime.indexOf('      var deepOpt',branchStart);
let payload;
new Function('env',`with(env){${runtime.slice(branchStart,branchEnd)}}`)({
  origin:{closest:()=>true},quickAnswers:{0:0,1:0,2:0},quickStep:2,quiz,submitting:false,
  clearErrors(){},submitWithEmail(value){payload=value;},
});
assert.deepEqual(payload,{path:'quick',answers:[0,0,0]});
console.log('PASS: three answered questions with only one or two mapped questions return exactly their matched products.');
