import assert from "node:assert/strict";
// End-to-end Deep Dosha flow on the real server code: spec questions -> result for all seven outcomes,
// ritual products from a PRANA-like catalog, locked/unlocked report, and the report email HTML.
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import { DatabaseSync } from "node:sqlite";
import { inlineLocalImports } from "./inline-local.mjs";

globalThis.doshaFlowDb = new DatabaseSync(":memory:");
const prismaStub = `const prisma = {
  async $executeRawUnsafe(sql, ...args) { return Number(globalThis.doshaFlowDb.prepare(sql).run(...args).changes); },
  async $queryRawUnsafe(sql, ...args) { return globalThis.doshaFlowDb.prepare(sql).all(...args); }
};`;
const shared = await transform(await readFile("app/quiz-shared.ts", "utf8"), { loader: "ts", format: "esm" });
const sharedUrl = `data:text/javascript;base64,${Buffer.from(shared.code).toString("base64")}`;
let quizSource = (await readFile("app/quiz.server.ts", "utf8"))
  .replace('import prisma from "./db.server";', prismaStub)
  .replace('import defaultWidgetCss from "../extensions/dosha-quiz/assets/dosha-quiz.css?raw";', 'const defaultWidgetCss = "";')
  .replace('import scanCardIcon from "../public/images/onboarding/scan.svg?raw";', 'const scanCardIcon = "<svg/>";')
  .replace('import deepCardIcon from "../public/images/onboarding/dosha.svg?raw";', 'const deepCardIcon = "<svg/>";')
  .replace('import quickCardIcon from "../public/images/onboarding/quiz.svg?raw";', 'const quickCardIcon = "<svg/>";')
  .replace('from "./quiz-shared";', `from "${sharedUrl}";`);
const quizCode = (await transform(await inlineLocalImports(quizSource), { loader: "ts", format: "esm" })).code;
const api = await import(`data:text/javascript;base64,${Buffer.from(quizCode).toString("base64")}`);

let reportSource = (await readFile("app/report.server.ts", "utf8")).replace(/import prisma from .*?;/, prismaStub);
const reportCode = (await transform(await inlineLocalImports(reportSource), { loader: "ts", format: "esm" })).code;
const reports = await import(`data:text/javascript;base64,${Buffer.from(reportCode).toString("base64")}`);
const emailCode = (await transform(await readFile("app/report-email.server.ts", "utf8"), { loader: "ts", format: "esm" })).code;
const email = await import(`data:text/javascript;base64,${Buffer.from(emailCode).toString("base64")}`);

// A store catalog named like PRANA's (the mask is "Purifying Clay Mask" in the store, "Purifying Mask" in the spec).
const titles = ["Rose Jasmine Milk Cleanser", "Pure Rose Water Toning Mist", "Saffron Glow Serum", "Bakuchiol Night Restorative Serum", "Saffron Radiance Moisturizer", "Turmeric & Sandalwood Purifying Clay Mask", "Gift Card"];
const nodes = titles.map((title, at) => ({ title, handle: "prana-" + at, tags: [], productType: "", featuredMedia: { preview: { image: { url: `https://cdn.example/${at}.jpg` } } }, variants: { nodes: [{ id: "gid://shopify/ProductVariant/" + (100 + at), title: "Default", price: "50.00", image: null }] } }));
const admin = { graphql: async () => ({ json: async () => ({ data: { products: { nodes } } }) }) };

const quiz = api.normalizeQuiz({ layout: "single", singleFlow: "deep", enabledPaths: ["deep"], resultMode: "personalized", quick: [], deep: api.DEEP_QUESTIONS });
assert.equal(quiz.deep.length, 18);
const letters = (pattern) => [...pattern].map((letter) => "ABC".indexOf(letter));
const cases = {
  vata: "AAAAAAAAAAAAABBBCC", pitta: "BBBBBBBBBBBBBBBBBB", kapha: "CCCCCCCCCCCCCCCCCC", balanced: "AAAAAABBBBBBCCCCCC",
  "dual-vata-pitta": "AAAAAAAAABBBBBBBCC", "dual-vata-kapha": "AAAAAAABBBBCCCCCCC", "dual-kapha-pitta": "AABBBBBBBBCCCCCCCC",
};
const expectedRitual = {
  vata: ["Rose Jasmine Milk Cleanser", "Pure Rose Water Toning Mist", "Saffron Glow Serum", "Saffron Radiance Moisturizer", "Bakuchiol Night Restorative Serum", "Turmeric & Sandalwood Purifying Clay Mask"],
  kapha: ["Rose Jasmine Milk Cleanser", "Pure Rose Water Toning Mist", "Saffron Glow Serum", "Bakuchiol Night Restorative Serum", "Turmeric & Sandalwood Purifying Clay Mask", "Saffron Radiance Moisturizer"],
};
for (const [dosha, pattern] of Object.entries(cases)) {
  api.clearProductCache?.("flow-" + dosha);
  const result = await api.buildQuizResult({ path: "deep", answers: letters(pattern) }, "flow-" + dosha, admin, quiz);
  assert.equal(result.dosha, dosha, pattern);
  assert.equal(Object.values(result.percentages).reduce((sum, value) => sum + value, 0), 100, dosha);
  assert.ok(result.guide && result.guide.signature && result.guide.ritual.morning && result.guide.usage.length === 6, dosha + " guide");
  assert.ok(result.products.length >= 5 && result.products.every((product) => product.title !== "Gift Card" && product.why && product.variantId), dosha + " products");
  if (expectedRitual[dosha]) assert.deepEqual(result.products.map((product) => product.title), expectedRitual[dosha], dosha + " ritual order");
  // Locked until an email is given; the guide and products only come back after unlocking.
  const stored = await reports.storeReport("flow-shop", result);
  assert.equal(stored.locked, true);
  assert.equal(stored.guide, undefined);
  assert.deepEqual(stored.products, []);
  const unlocked = await reports.unlockReport("flow-shop", stored.reportId, `buyer-${dosha.length}-${dosha}@example.com`);
  assert.equal(unlocked.result.locked, false);
  assert.ok(unlocked.result.guide && unlocked.result.products.length);
  assert.equal(unlocked.delivery, "not_configured");
  // Report email: every section of the reading, product links, nothing unescaped.
  const html = email.reportEmailHtml(unlocked.result, "https://pranabeauty.com");
  for (const part of ["Your Dosha Report", "Ingredient allies", "Your ritual", "How to use your products", "Your ritual products", "https://pranabeauty.com/products/"]) assert.ok(html.includes(part), dosha + " email: " + part);
}
const hostile = email.reportEmailHtml({ dosha: "vata", profile: { name: "<script>x</script>" }, guide: api.buildQuizResult ? undefined : undefined, products: [{ title: "<b>", handle: "a\"onmouseover=1", why: "", price: "", image: "javascript:alert(1)" }] }, "https://x.test");
assert.ok(!hostile.includes("<script>x") && !hostile.includes('"onmouseover=1'));

// Merchant mappings still win over the spec ritual; quick quiz results get no guide.
const mapped = api.normalizeQuiz({ ...quiz, mappings: [{ id: "m", tags: ["vata"], productHandle: "prana-6", grouping: "or" }] });
api.clearProductCache?.("flow-mapped");
const mappedResult = await api.buildQuizResult({ path: "deep", answers: letters(cases.vata) }, "flow-mapped", admin, mapped);
assert.deepEqual(mappedResult.products.map((product) => product.handle), ["prana-6"]);
const productsMode = await api.buildQuizResult({ path: "deep", answers: letters(cases.vata) }, "flow-products", admin, { ...quiz, resultMode: "products" });
assert.equal(productsMode.guide, undefined);
// A quiz with neutral answers (fewer counted points) still gets a result, never an error.
const neutral = { ...quiz, deep: quiz.deep.map((question, at) => at < 9 ? question : { ...question, options: question.options.map((option) => ({ ...option, tag: "balanced", tags: ["balanced"], scores: {} })) }) };
const partial = await api.buildQuizResult({ path: "deep", answers: letters("AAAAAAAAACCCCCCCCC") }, "flow-neutral", admin, neutral);
assert.equal(partial.dosha, "vata");
// Report email through Resend: two unlocks at once send one email; a failed send can be retried.
process.env.RESEND_API_KEY = "test-key"; process.env.REPORT_FROM_EMAIL = "PRANA <ritual@example.com>";
let resendCalls = 0, resendFails = false;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url).includes("api.resend.com")) { resendCalls++; await new Promise((resolve) => setTimeout(resolve, 20)); return { ok: !resendFails, status: resendFails ? 500 : 200 }; }
  return realFetch(url, options);
};
const raceResult = await api.buildQuizResult({ path: "deep", answers: letters(cases.pitta) }, "flow-race", admin, quiz);
const raceStored = await reports.storeReport("flow-shop", raceResult);
const [first, second] = await Promise.all([reports.unlockReport("flow-shop", raceStored.reportId, "race@example.com"), reports.unlockReport("flow-shop", raceStored.reportId, "race@example.com")]);
assert.equal(resendCalls, 1);
assert.deepEqual([first.delivery, second.delivery].sort(), ["queued", "queued"]);
resendFails = true; resendCalls = 0;
const retryStored = await reports.storeReport("flow-shop", raceResult);
assert.equal((await reports.unlockReport("flow-shop", retryStored.reportId, "retry@example.com")).delivery, "failed");
resendFails = false;
assert.equal((await reports.unlockReport("flow-shop", retryStored.reportId, "retry@example.com")).delivery, "queued");
assert.equal((await reports.unlockReport("flow-shop", retryStored.reportId, "retry@example.com")).delivery, "queued");
assert.equal(resendCalls, 2);
assert.equal((await reports.emailDeliverySummary("flow-shop")).configured, true);
globalThis.fetch = realFetch;

console.log("PASS: all seven Deep Dosha results end to end (rules, guide, ritual products, locked/unlocked report, report email), mappings first, neutral answers safe, one email per report even on double unlock, failed sends retry.");
