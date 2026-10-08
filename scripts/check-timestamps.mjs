/* global globalThis */
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import { PrismaClient } from '@prisma/client';
import { transform } from 'esbuild';
const directory = await mkdtemp(join(tmpdir(), 'skin-timestamp-'));
const prisma = new PrismaClient({datasources:{db:{url:'file:'+join(directory,'test.sqlite').replaceAll('\\','/')}}});
globalThis.timestampTestDb = prisma;
async function load(file) {
 const source=(await readFile(file,'utf8')).replace(/import prisma from .*?;/,'const prisma = globalThis.timestampTestDb;');
 const code=(await transform(source,{loader:'ts',format:'esm'})).code;
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
try {
 const setup=await load('app/setup.server.ts');
 assert.equal(await setup.isThemeActivated('test-shop'),false);
 await setup.markThemeActivated('test-shop');
 assert.equal(await setup.isThemeActivated('test-shop'),true);
 await setup.markThemeActivated('test-shop');
 assert.equal(await setup.isThemeActivated('test-shop'),true);
 await prisma.$executeRawUnsafe('CREATE TABLE ScanUsage (shop TEXT NOT NULL, hour INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(shop,hour))');
 const attempts=await Promise.all(Array.from({length:100},()=>prisma.$executeRawUnsafe('INSERT INTO ScanUsage (shop,hour,count) VALUES (?,?,1) ON CONFLICT(shop,hour) DO UPDATE SET count=count+1 WHERE count<60','test-shop',1)));
 assert.equal(attempts.filter(value=>value===1).length,60);
 assert.equal(await prisma.$executeRawUnsafe('INSERT INTO ScanUsage (shop,hour,count) VALUES (?,?,1) ON CONFLICT(shop,hour) DO UPDATE SET count=count+1 WHERE count<60','other-shop',1),1);
 console.log('PASS: 100 concurrent local quota attempts admit exactly 60; other shop remains independent.');
 const reports=await load('app/report.server.ts');
 await reports.reportStats('test-shop');
 const expires=Date.now()+7*86400000;
 await prisma.$executeRawUnsafe('INSERT INTO QuizReport (id,shop,payload,email,expires) VALUES (?,?,?,?,?)','test','test-shop','{}','test@example.invalid',expires);
 const emails=await reports.collectedEmails('test-shop');
 assert.equal(emails[0].latestResultAt,expires-7*86400000);
 assert.equal((await reports.collectedEmails('other-shop')).length,0);
 await setup.deleteShopSetup('test-shop');
 assert.equal(await setup.isThemeActivated('test-shop'),false);
 console.log('PASS: real Prisma SQLite millisecond timestamps, activation persistence and email shop isolation.');
} finally {await prisma.$disconnect();delete globalThis.timestampTestDb;await rm(directory,{recursive:true,force:true});}
