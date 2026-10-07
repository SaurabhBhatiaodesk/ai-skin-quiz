import assert from "node:assert/strict";
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
const compiled = await transform(source, { loader: "ts", format: "esm" });
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
db.prepare("UPDATE QuizReport SET expires=0").run();
await assert.rejects(api.unlockReport("test",stored.reportId,"test@example.com"));
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM QuizReport").get().count,0);
db.close();
console.log("Passed: durable report storage, server email gate, store isolation, validation, quick ungated result and expiry cleanup.");