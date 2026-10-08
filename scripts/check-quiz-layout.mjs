import assert from "node:assert/strict";
// Regression checks use an in-memory database and a minimal storefront DOM.
import { readFile } from "node:fs/promises";
import { build, transform } from "esbuild";
import vm from "node:vm";
import { DatabaseSync } from "node:sqlite";
globalThis.quizTestDatabase = new DatabaseSync(":memory:");

const shared = await transform(await readFile("app/quiz-shared.ts", "utf8"), { loader: "ts", format: "esm" });
globalThis.quizTestPayload = null;
let source = await readFile("app/quiz.server.ts", "utf8");
source = source.replace('import prisma from "./db.server";', `const prisma = {
  async $executeRawUnsafe(sql, ...args) {
    const result = globalThis.quizTestDatabase.prepare(sql).run(...args);
    globalThis.quizTestPayload = JSON.stringify(globalThis.quizTestDatabase.prepare('SELECT shop,payload FROM QuizConfig ORDER BY shop').all());
    return Number(result.changes);
  },
  async $queryRawUnsafe(sql, ...args) { return globalThis.quizTestDatabase.prepare(sql).all(...args); }
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
// New quizzes start empty; tests add the stock questions where a flow needs them.
const withQuestions = quiz => ({ ...quiz, quick: quiz.enabledPaths.includes("quick") ? structuredClone(api.QUICK_QUESTIONS) : [], deep: quiz.enabledPaths.includes("deep") ? structuredClone(api.DEEP_QUESTIONS) : [] });
const emptyQuiz = await api.createQuiz("test", "Empty start", "three");
assert.equal(emptyQuiz.quick.length + emptyQuiz.deep.length, 0);
assert.equal((await api.loadQuiz("test", emptyQuiz.handle)).quick.length, 0);
await assert.rejects(api.publicQuiz("test", emptyQuiz.handle), /no questions yet/);
await assert.rejects(api.buildQuizResult({ code: emptyQuiz.handle, path: "quick", answers: {} }, "test"), /no questions yet/);
await api.deleteQuiz("test", emptyQuiz.handle);
const deepQuiz = withQuestions(await api.createQuiz("test", "Deep audit", "three"));
deepQuiz.widgetCss = ".prana-quiz .entry-card { border-radius: 24px; }";
deepQuiz.deep[8].text = "Edited current-state question";
deepQuiz.deep[8].options[0].hint = "Edited hint";
deepQuiz.deep[8].options[0].tags = ["hydration", "vata"];
await api.saveQuiz("test", deepQuiz, deepQuiz.handle);
const reloadedDeep = await api.loadQuiz("test", deepQuiz.handle);
assert.equal(reloadedDeep.deep.length, 18);
assert.equal(reloadedDeep.widgetCss, deepQuiz.widgetCss);
assert.equal((await api.publicQuiz("test", deepQuiz.handle)).widgetCss, deepQuiz.widgetCss);
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
const created = withQuestions(await api.createQuiz("test", "Single", "single"));
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
// No mapping matched, so the result falls back to keyword matches from the real catalog (never invented products).
assert.equal(andResult.products[0].variantId, undefined);
assert.equal(andResult.products[0].handle, "serum");
loaded.mappings[0].grouping = "or";
await api.saveQuiz("test", loaded, loaded.handle);
const orResult = await api.buildQuizResult({ code: loaded.handle, path: "quick", answers: { 0: 0 } }, "test", admin);
assert.equal(orResult.products[0].variantId, variantId);
assert.equal((await api.loadQuiz("test", loaded.handle)).mappings[0].grouping, "or");
api.clearProductCache();
const failedProducts = await api.buildQuizResult({ code: loaded.handle, path: "quick", answers: { 0: 0 } }, "test", { graphql: async () => { throw new Error("Unavailable"); } });
assert.deepEqual(failedProducts.products, []);
assert.deepEqual(result.products, []);

// The storefront script imports helpers, so test the same bundle the theme extension ships.
const storefrontBundle = (await build({ entryPoints: ["app/storefront-quiz.js"], bundle: true, write: false, format: "iife" })).outputFiles[0].text;

async function storefront(layout, scanReady = false) {
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
  vm.runInNewContext(storefrontBundle, {
    document: { readyState: "complete", querySelectorAll() { return [root]; }, addEventListener() {} },
    window: { scrollTo() {} },
    URLSearchParams,
    navigator: {},
    fetch: async () => ({ ok: true, json: async () => ({ layout, scanReady, quick: [] }) }),
  });
  await new Promise(resolve => setImmediate(resolve));
  // A scan-only block stays on its hidden start screen until analysis is connected.
  assert.deepEqual([...active], [layout === "scan" && scanReady ? "scanner" : layout === "single" ? "quick" : "entry"]);
}
await storefront("single");
await storefront("three");
await storefront("scan");
await storefront("scan", true);
const scanOnly = await api.createQuiz("test", "Scan only", "scan");
assert.equal(scanOnly.layout, "scan");
assert.equal(scanOnly.quick.length, 0);
assert.equal(scanOnly.deep.length, 0);
await api.saveQuiz("test", scanOnly, scanOnly.handle);
assert.equal((await api.loadQuiz("test", scanOnly.handle)).layout, "scan");
await assert.rejects(api.buildQuizResult({ code: scanOnly.handle, path: "quick" }, "test"));
await assert.rejects(api.buildQuizResult({ code: scanOnly.handle, path: "scan" }, "test"), /not configured/);
const scanQuiz = withQuestions(await api.createQuiz("test", "Scan settings", "three"));
scanQuiz.scanner = { title: "My Skin Scan", description: "Upload a selfie for the demo.", camera: false, upload: true };
await api.saveQuiz("test", scanQuiz, scanQuiz.handle);
assert.deepEqual((await api.loadQuiz("test", scanQuiz.handle)).scanner, scanQuiz.scanner);
assert.deepEqual((await api.publicQuiz("test", scanQuiz.handle)).scanner, scanQuiz.scanner);
scanQuiz.design = { background: "#ffffff", text: "#111111", accent: "#123456", buttonText: "#ffffff", font: "sans", radius: "pill" };
await api.saveQuiz("test", scanQuiz, scanQuiz.handle);
assert.deepEqual((await api.publicQuiz("test", scanQuiz.handle)).design, scanQuiz.design);
assert.throws(() => api.normalizeQuiz({ ...scanQuiz, design: { ...scanQuiz.design, accent: "bad" } }), /hex colors/);
assert.throws(() => api.normalizeQuiz({ ...scanQuiz, scanner: { ...scanQuiz.scanner, upload: false } }), /Enable camera or photo upload/);
const weighted = api.scoreDeep([0], [{ layer: 1, text: "Weighted", phase: "", sub: "", options: [{ label: "Blend", hint: "", tag: "vata", scores: { V: 6, P: 4 } }] }]);
assert.deepEqual(weighted.percentages, { vata: 60, pitta: 40, kapha: 0 });
assert.equal(weighted.dosha, "dual-vata-pitta");
const catalog = ["Rose Jasmine Milk Cleanser", "Pure Rose Water Toning Mist", "Saffron Glow Serum", "Bakuchiol Night Restorative Serum", "Saffron Radiance Moisturizer", "Turmeric & Sandalwood Mask"].map((title, at) => ({ title, handle: "product-" + at, price: "$10.00", image: "", tags: [], productType: "" }));
const ritualQuiz = api.normalizeQuiz({ quick: api.QUICK_QUESTIONS, deep: api.DEEP_QUESTIONS });
const ritual = api.ritualProducts(ritualQuiz, { path: "quick", answers: { 0: 2, 1: 1, 2: 1 } }, "pitta", catalog);
assert.deepEqual(ritual.slice(0, 3).map(product => product.title), ["Rose Jasmine Milk Cleanser", "Pure Rose Water Toning Mist", "Bakuchiol Night Restorative Serum"]);
assert.equal(api.ritualProducts(ritualQuiz, { path: "quick", answers: { 0: 0, 1: 0, 2: 0 } }, "vata", []).length, 0);
api.clearProductCache();
const inr = { graphql: async () => ({ json: async () => ({ data: { shop: { currencyCode: "INR" }, products: { nodes: [product] } } }) }) };
assert.equal((await api.loadStoreProducts(inr))[0].price, "₹12.00");
const pages = [];
const pagingAdmin = { graphql: async (query, options) => { pages.push(options?.variables?.after ?? null); return { json: async () => ({ data: { products: { pageInfo: { hasNextPage: pages.length < 2, endCursor: "p" + pages.length }, nodes: [{ ...product, handle: "p" + pages.length }] } } }) }; } };
assert.deepEqual((await api.loadStoreProducts(pagingAdmin)).map(item => item.handle), ["p1", "p2"]);
assert.equal(api.scoreQuick({ 0: 0, 1: 1, 2: 2 }, [0, 1, 2].map(() => ({ text: "Q", options: ["vata", "pitta", "kapha"].map(tag => ({ label: tag, tag, value: tag, tags: [tag] })) }))), "balanced");
const dualQuiz = withQuestions(await api.createQuiz("test", "Dual mapping", "single", ["deep"]));
dualQuiz.mappings = [{ id: "dual", tags: ["dual_vata_pitta"], productHandle: "serum", grouping: "or" }];
await api.saveQuiz("test", dualQuiz, dualQuiz.handle);
const dualAnswers = dualQuiz.deep.map((question, at) => at % 2);
const dualResult = await api.buildQuizResult({ code: dualQuiz.handle, path: "deep", answers: dualAnswers }, "test", admin);
assert.equal(dualResult.dosha, "dual-vata-pitta");
assert.equal(dualResult.products[0].why, "dual_vata_pitta");
console.log("Passed: layout creation, save/reload, legacy defaults, question validation, 40-question single flow, result restrictions, storefront startup, AND/OR mapping and variant recommendations.");

const standaloneDeep = withQuestions(await api.createQuiz("test", "Standalone Deep", "single", ["deep"]));
assert.equal(standaloneDeep.singleFlow, "deep");
await api.saveQuiz("test", standaloneDeep, standaloneDeep.handle);
assert.equal(standaloneDeep.quick.length, 0);
assert.equal(standaloneDeep.deep.length, 18);
const standaloneResult = await api.buildQuizResult({ code: standaloneDeep.handle, path: "deep", answers: Array(18).fill(0) }, "test");
assert.equal(standaloneResult.source, "Deep Dosha");
await assert.rejects(api.buildQuizResult({ code: standaloneDeep.handle, path: "quick", answers: {} }, "test"));
const twoPaths = withQuestions(await api.createQuiz("test", "Two paths", "three", ["quick", "scan"]));
assert.deepEqual(twoPaths.enabledPaths, ["quick", "scan"]);
assert.equal(twoPaths.deep.length, 0);
twoPaths.coverImage = "https://example.com/cover.jpg";
twoPaths.profileImage = "https://example.com/profile.jpg";
await api.saveQuiz("test", twoPaths, twoPaths.handle);
assert.equal((await api.loadQuiz("test", twoPaths.handle)).coverImage, twoPaths.coverImage);
assert.equal((await api.loadQuiz("test", twoPaths.handle)).profileImage, twoPaths.profileImage);
await assert.rejects(api.loadQuiz("test", "does-not-exist"));
console.log("Passed: standalone Deep, selected combined paths, image metadata persistence and unknown quiz rejection.");

const concurrent = await Promise.allSettled([api.createQuiz("concurrency-test", "First", "single", ["quick"]), api.createQuiz("concurrency-test", "Second", "single", ["quick"])]);
assert.equal(concurrent.filter(item => item.status === "fulfilled").length, 1);
assert.equal(concurrent.filter(item => item.status === "rejected").length, 1);
assert.equal((await api.loadLibrary("concurrency-test")).length, 1);
console.log("Passed: simultaneous library writes fail safely instead of silently losing changes.");

// Uploaded SVG stays an isolated image and persists through the real quiz storage path.
const iconQuiz = await api.createQuiz("icons-test", "Icons", "three");
const svgIcon = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>').toString("base64");
await api.saveQuiz("icons-test", {...withQuestions(iconQuiz),cardIcons:{scan:svgIcon,quick:"https://example.com/quick.png"}},iconQuiz.handle);
const iconReload = await api.loadQuiz("icons-test",iconQuiz.handle);
assert.equal(iconReload.cardIcons.scan,svgIcon);
assert.equal((await api.publicQuiz("icons-test",iconQuiz.handle)).cardIcons.quick,"https://example.com/quick.png");
assert.throws(()=>api.normalizeQuiz({...iconReload,cardIcons:{scan:"javascript:alert(1)"}}),/icon/);
assert.throws(()=>api.normalizeQuiz({...iconReload,cardIcons:{scan:"data:image/png;base64,"+"A".repeat(90001)}}),/icon/);
await api.saveQuiz("icons-test",{...iconReload,cardIcons:{scan:""}},iconQuiz.handle);
assert.equal((await api.loadQuiz("icons-test",iconQuiz.handle)).cardIcons.scan,undefined);
console.log("PASS: SVG icon upload, save/reload, public API, unsafe URL/oversize rejection, and reset.");
