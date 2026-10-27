import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

// The storefront renders the full spec reading for every one of the seven results, with all text escaped.
const source = await readFile("app/storefront-quiz.js", "utf8");
const start = source.indexOf("    function renderDoshaGuide(guide) {");
const escStart = source.indexOf("    function esc(value) {", start);
const escEnd = source.indexOf("// Result copy may use", escStart);
const render = new Function(source.slice(start, escStart) + source.slice(escStart, escEnd) + "; return renderDoshaGuide;")();
const content = await import("data:text/javascript;base64," + Buffer.from((await transform(await readFile("app/dosha-content.ts", "utf8"), { loader: "ts", format: "esm" })).code).toString("base64"));
for (const key of Object.keys(content.DOSHA_CONTENT)) {
  const guide = content.doshaGuide(key);
  const html = render(guide);
  for (const title of ["Your skin&#39;s signature","Ingredient allies", "Skin profile", "Your ritual prescription", "How to use your products"]) assert.ok(html.includes(title), `${key}: ${title}`);
  assert.equal((html.match(/class="dg-use"/g) || []).length, guide.usage.length, key);
  if (guide.balance.length) assert.ok(html.includes("Signs of balance") && html.includes("Signs of imbalance"), key);
  if (guide.seasonal.length) assert.ok(html.includes("Seasonal guidance"), key);
}
const hostile = render({ ...content.doshaGuide("vata"), tagline: "<img src=x onerror=alert(1)>" });
assert.ok(!hostile.includes("<img src=x"));
console.log("PASS: the full dosha reading renders for all seven results, escaped.");
