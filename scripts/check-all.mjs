import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const tests=readdirSync('scripts').filter(name=>/^check-.*\.mjs$/.test(name)&&!['check-all.mjs','check-production-database.mjs','check-timestamps.mjs'].includes(name)).sort();
let failed=0;
for(const test of tests){const result=spawnSync(process.execPath,['scripts/'+test],{encoding:'utf8',maxBuffer:4*1024*1024});if(result.status!==0){failed++;console.error('FAIL '+test);console.error((result.stderr||result.stdout||String(result.error)).replace(/data:text[^\s)]+/g,'[compiled test module]').slice(-2000));}else console.log('PASS '+test);}
console.log((tests.length-failed)+'/'+tests.length+' isolated checks passed.');
if(failed)process.exit(1);
