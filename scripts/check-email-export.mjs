import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {transform} from 'esbuild';
const code=await transform(await readFile('app/email-export.ts','utf8'),{loader:'ts',format:'esm'});const {emailCsv}=await import('data:text/javascript;base64,'+Buffer.from(code.code).toString('base64'));
const csv=emailCsv([{email:'=formula@example.com',results:1,queued:0,failed:1,latestResultAt:0},{email:'a"b@example.com',results:2,queued:1,failed:0,latestResultAt:0}]);
assert.ok(csv.includes('"\'=formula@example.com"'));assert.ok(csv.includes('a""b@example.com'));assert.ok(csv.includes('1970-01-01T00:00:00.000Z'));assert.ok(csv.startsWith('\uFEFF'));console.log('PASS: email CSV escapes values, neutralizes spreadsheet formulas and exports UTC timestamps.');
