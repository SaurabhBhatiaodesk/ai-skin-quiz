import assert from "node:assert/strict";
import { inlineLocalImports } from "./inline-local.mjs";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { transform } from "esbuild";
const db = new DatabaseSync(":memory:");
globalThis.reportTestDb = db;
let source = await readFile("app/report.server.ts", "utf8");
source = source.replace('import prisma from "./db.server";', `const prisma = {
  async $executeRawUnsafe(sql, ...args) { return globalThis.reportTestDb.prepare(sql).run(...args); },
  async $queryRawUnsafe(sql, ...args) { return globalThis.reportTestDb.prepare(sql).all(...args); }
};`);
const compiled = await transform(await inlineLocalImports(source), { loader: "ts", format: "esm" });
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`);
const result = { dosha:"vata", source:"Deep Dosha", percentages:{vata:60,pitta:40,kapha:0}, insight:"Detailed report", profile:{name:"Vata",insight:"Private guide",essence:"Details",products:["serum"]}, products:[{title:"Serum",handle:"serum"}] };
const stored = await api.storeReport("test",result);
assert.equal(stored.locked,true);
assert.equal(stored.insight,"");
assert.deepEqual(stored.products,[]);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM QuizReport").get().count,1);
await assert.rejects(api.unlockReport("other",stored.reportId,"test@example.com"));
await assert.rejects(api.unlockReport("test",stored.reportId,"invalid"));
const unlocked = await api.unlockReport("test",stored.reportId,"test@example.com");
assert.equal(unlocked.result.insight,"Detailed report");
assert.equal(unlocked.result.locked,false);
assert.equal(db.prepare("SELECT email FROM QuizReport").get().email,"test@example.com");
const quick = await api.storeReport("test",{...result,source:"Quick Quiz"});
assert.equal(quick.locked,false);
assert.equal(quick.insight,"Detailed report");
const skipped = await api.storeReport("test", result, true);
assert.equal(skipped.locked, false);
assert.equal(skipped.insight, "Detailed report");
assert.deepEqual(skipped.products, result.products);
assert.equal(db.prepare("SELECT email FROM QuizReport WHERE id=?").get(skipped.reportId).email, null);
db.prepare("UPDATE QuizReport SET expires=0").run();
await assert.rejects(api.unlockReport("test",stored.reportId,"test@example.com"));
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM QuizReport").get().count,0);
const priorKey=process.env.KLAVIYO_PRIVATE_API_KEY, priorShop=process.env.KLAVIYO_SHOP, priorFetch=globalThis.fetch;
try {
 process.env.KLAVIYO_PRIVATE_API_KEY='test-placeholder';process.env.KLAVIYO_SHOP='delivery-test';
 const report=await api.storeReport('delivery-test',result);
 globalThis.fetch=async()=>({ok:false,status:503});
 const failed=await api.unlockReport('delivery-test',report.reportId,'delivery@example.com');
 assert.equal(failed.delivery,'failed');
 assert.equal((await api.emailDeliverySummary('delivery-test')).failed,1);
 globalThis.fetch=async()=>({ok:true,status:202});
 const retry=await api.unlockReport('delivery-test',report.reportId,'delivery@example.com');
 assert.equal(retry.delivery,'queued');
 const summary=await api.emailDeliverySummary('delivery-test');assert.equal(summary.queued,1);assert.equal(summary.failed,0);
 globalThis.fetch=async()=>{throw Error('Queued events must not send twice');};
 assert.equal((await api.unlockReport('delivery-test',report.reportId,'delivery@example.com')).delivery,'queued');
} finally {
 globalThis.fetch=priorFetch;
 if(priorKey===undefined)delete process.env.KLAVIYO_PRIVATE_API_KEY;else process.env.KLAVIYO_PRIVATE_API_KEY=priorKey;
 if(priorShop===undefined)delete process.env.KLAVIYO_SHOP;else process.env.KLAVIYO_SHOP=priorShop;
}
console.log('PASS: delivery failures are visible, retry can queue successfully, queued events do not resend.');
db.close();
console.log("Passed: durable report storage, server email gate, store isolation, validation, quick ungated result and expiry cleanup.");