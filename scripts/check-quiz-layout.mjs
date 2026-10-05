import assert from "node:assert/strict";
// Regression checks use an in-memory database and a minimal storefront DOM.
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import vm from "node:vm";

const shared = await transform(await readFile("app/quiz-shared.ts", "utf8"), { loader: "ts", format: "esm" });
globalThis.quizTestPayload = null;
let source = await readFile("app/quiz.server.ts", "utf8");
source = source.replace('import prisma from "./db.server";', `const prisma = {
  async $executeRawUnsafe(sql, shop, payload) { if (payload) globalThis.quizTestPayload = payload; },
  async $queryRawUnsafe() { return globalThis.quizTestPayload ? [{ payload: globalThis.quizTestPayload }] : []; }
};`);
source = source.replace('from "./quiz-shared";', `from "data:text/javascript;base64,${Buffer.from(shared.code).toString("base64")}";`);
const compiled = await transform(source, { loader: "ts", format: "esm" });
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`);
const legacy = api.normalizeQuiz({ quick: api.QUICK_QUESTIONS, deep: api.DEEP_QUESTIONS });
assert.equal(legacy.layout, "three");
assert.ok(legacy.deep.length);
assert.equal(legacy.deep.length, 18);
assert.deepEqual([1, 2, 3].map(layer => legacy.deep.filter(question => question.layer === layer).length), [8, 6, 4]);
for (const question of legacy.deep) {
  assert.ok(question.text && question.options.length >= 2);
  for (const option of question.options) assert.ok(option.label && option.tags.length);
}
for (const [answer, expected] of [[0, "vata"], [1, "pitta"], [2, "kapha"]]) {
  assert.equal(api.scoreDeep(Array(18).fill(answer), legacy.deep).dosha, expected);
}
const deepQuiz = await api.createQuiz("test", "Deep audit", "three");
deepQuiz.deep[8].text = "Edited current-state question";
deepQuiz.deep[8].options[0].hint = "Edited hint";
deepQuiz.deep[8].options[0].tags = ["hydration", "vata"];
await api.saveQuiz("test", deepQuiz, deepQuiz.handle);
const reloadedDeep = await api.loadQuiz("test", deepQuiz.handle);
assert.equal(reloadedDeep.deep.length, 18);
assert.equal(reloadedDeep.deep[8].options[0].hint, "Edited hint");
assert.deepEqual(reloadedDeep.deep[8].options[0].tags, ["hydration", "vata"]);
assert.equal((await api.publicQuiz("test", deepQuiz.handle)).deep[8].text, "Edited current-state question");
const deepResult = await api.buildQuizResult({ code: deepQuiz.handle, path: "deep", answers: Array(18).fill(0) }, "test");
assert.equal(deepResult.source, "Deep Dosha");
assert.equal(deepResult.dosha, "vata");
assert.equal(deepResult.showUpgrade, false);
const beforeInvalidSave = globalThis.quizTestPayload;
await assert.rejects(api.saveQuiz("test", { ...deepQuiz, deep: [] }, deepQuiz.handle));
assert.equal(globalThis.quizTestPayload, beforeInvalidSave);
assert.throws(() => api.normalizeQuiz({ quick: api.QUICK_QUESTIONS, deep: [] }));
assert.throws(() => api.normalizeQuiz({ layout: "single", quick: [], deep: [] }));
const created = await api.createQuiz("test", "Single", "single");
assert.equal(created.layout, "single");
assert.equal(created.deep.length, 0);
created.quick = Array.from({ length: 40 }, () => created.quick[0]);
await api.saveQuiz("test", created, created.handle);
const loaded = await api.loadQuiz("test", created.handle);
assert.equal(loaded.layout, "single");
assert.equal(loaded.quick.length, 40);
assert.equal((await api.publicQuiz("test", created.handle)).layout, "single");
await assert.rejects(api.buildQuizResult({ code: created.handle, path: "scan" }, "test"));
const result = await api.buildQuizResult({ code: created.handle, path: "quick", answers: {} }, "test");
assert.equal(result.showUpgrade, false);

const variantId = "gid://shopify/ProductVariant/123";
const product = { title: "Serum", handle: "serum", tags: [], productType: "", featuredMedia: { preview: { image: { url: "product.jpg" } } }, variants: { nodes: [{ id: variantId, title: "30 ml", price: "12", image: { url: "variant.jpg" } }] } };
const admin = { graphql: async () => ({ json: async () => ({ data: { products: { nodes: [product] } } }) }) };
const storeProducts = await api.loadStoreProducts(admin);
assert.equal(storeProducts[0].variants[0].id, variantId);
const pagedAdmin = { graphql: async query => ({ json: async () => query.includes("DoshaQuizVariantPage")
  ? { data: { product: { variants: { nodes: [{ id: "gid://shopify/ProductVariant/124", title: "50 ml", price: "18" }], pageInfo: { hasNextPage: false, endCursor: "last" } } } } }
  : { data: { products: { nodes: [{ ...product, id: "gid://shopify/Product/1", variants: { nodes: [...product.variants.nodes], pageInfo: { hasNextPage: true, endCursor: "first" } } }] } } } }) };
assert.equal((await api.loadStoreProducts(pagedAdmin))[0].variants.length, 2);
loaded.quick[0].options[0].tags = ["skin", "glow"];
loaded.mappings = [{ id: "variant", tags: ["skin", "glow"], productHandle: "serum", grouping: "and", variantId }];
await api.saveQuiz("test", loaded, loaded.handle);
const variantResult = await api.buildQuizResult({ code: loaded.handle, path: "quick", answers: { 0: 0 } }, "test", admin);
assert.equal(variantResult.products[0].variantId, variantId);
assert.equal(variantResult.products[0].image, "variant.jpg");
assert.equal(variantResult.products[0].price, "$12.00");
loaded.mappings[0].tags = ["skin", "missing"];
await api.saveQuiz("test", loaded, loaded.handle);
const andResult = await api.buildQuizResult({ code: loaded.handle, path: "quick", answers: { 0: 0 } }, "test", admin);
assert.deepEqual(andResult.products, []);
loaded.mappings[0].grouping = "or";
await api.saveQuiz("test", loaded, loaded.handle);
const orResult = await api.buildQuizResult({ code: loaded.handle, path: "quick", answers: { 0: 0 } }, "test", admin);
assert.equal(orResult.products[0].variantId, variantId);
assert.equal((await api.loadQuiz("test", loaded.handle)).mappings[0].grouping, "or");
const failedProducts = await api.buildQuizResult({ code: loaded.handle, path: "quick", answers: { 0: 0 } }, "test", { graphql: async () => { throw new Error("Unavailable"); } });
assert.deepEqual(failedProducts.products, []);
assert.deepEqual(result.products, []);

async function storefront(layout) {
  const active = new Set(["entry"]);
  const screens = ["entry", "quick", "deep", "scanner"].map(name => ({
    classList: { remove() { active.delete(name); }, add() { active.add(name); } },
  }));
  const root = {
    getAttribute(key) { return key === "data-quiz-code" ? "single" : null; },
    setAttribute() {}, addEventListener() {},
    querySelectorAll(selector) { return selector === ".screen" ? screens : []; },
    querySelector(selector) {
      const match = selector.match(/data-screen="([^"]+)"/);
      return match ? screens[["entry", "quick", "deep", "scanner"].indexOf(match[1])] : null;
    },
  };
  vm.runInNewContext(await readFile("app/storefront-quiz.js", "utf8"), {
    document: { readyState: "complete", querySelectorAll() { return [root]; } },
    window: { scrollTo() {} },
    URLSearchParams,
    navigator: {},
    fetch: async () => ({ ok: true, json: async () => ({ layout, quick: [] }) }),
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([...active], [layout === "scan" ? "scanner" : layout === "single" ? "quick" : "entry"]);
}
await storefront("single");
await storefront("three");
await storefront("scan");
const scanOnly = await api.createQuiz("test", "Scan only", "scan");
assert.equal(scanOnly.layout, "scan");
assert.equal(scanOnly.quick.length, 0);
assert.equal(scanOnly.deep.length, 0);
await api.saveQuiz("test", scanOnly, scanOnly.handle);
assert.equal((await api.loadQuiz("test", scanOnly.handle)).layout, "scan");
await assert.rejects(api.buildQuizResult({ code: scanOnly.handle, path: "quick" }, "test"));
await assert.rejects(api.buildQuizResult({ code: scanOnly.handle, path: "scan" }, "test"), /not configured/);
const scanQuiz = await api.createQuiz("test", "Scan settings", "three");
scanQuiz.scanner = { title: "My Skin Scan", description: "Upload a selfie for the demo.", camera: false, upload: true };
await api.saveQuiz("test", scanQuiz, scanQuiz.handle);
assert.deepEqual((await api.loadQuiz("test", scanQuiz.handle)).scanner, scanQuiz.scanner);
assert.deepEqual((await api.publicQuiz("test", scanQuiz.handle)).scanner, scanQuiz.scanner);
assert.throws(() => api.normalizeQuiz({ ...scanQuiz, scanner: { ...scanQuiz.scanner, upload: false } }), /Enable camera or photo upload/);
console.log("Passed: layout creation, save/reload, legacy defaults, question validation, 40-question single flow, result restrictions, storefront startup, AND/OR mapping and variant recommendations.");
