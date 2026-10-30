import { readFile, writeFile } from "node:fs/promises";
import { transform } from "esbuild";

// Storefront CSS is written in app/storefront-quiz.css and shipped minified as two theme assets, each under
// Shopify's 100 KB stylesheet limit: dosha-quiz.css (the blocks' stylesheet, loaded in <head>) and
// dosha-quiz-extra.css (linked from the snippet, so it loads after and keeps the source's cascade order).
const LIMIT = 100000;
const source = await readFile("app/storefront-quiz.css", "utf8");
const header = "/*! Generated from app/storefront-quiz.css by npm run build:widget. Edit the source, not this file. */\n";
const minify = async (css) => (await transform(css, { loader: "css", minify: true })).code;

// Split only between top-level rules (brace depth 0, outside comments and strings), as close to the middle as possible.
const cuts = [];
let depth = 0;
for (let at = 0; at < source.length; at++) {
  const char = source[at];
  if (char === "/" && source[at + 1] === "*") { at = source.indexOf("*/", at + 2) + 1; continue; }
  if (char === '"' || char === "'") { at = source.indexOf(char, at + 1); continue; }
  if (char === "{") depth++;
  else if (char === "}" && --depth === 0) cuts.push(at + 1);
}
if (depth !== 0) throw new Error("Unbalanced braces in app/storefront-quiz.css");
const middle = cuts.reduce((best, cut) => (Math.abs(cut - source.length / 2) < Math.abs(best - source.length / 2) ? cut : best), cuts[0]);
const [first, second] = [await minify(source.slice(0, middle)), await minify(source.slice(middle))];
for (const [name, css] of [["dosha-quiz.css", first], ["dosha-quiz-extra.css", second]]) {
  const output = header + css;
  if (output.length > LIMIT) throw new Error(`${name} is ${output.length} bytes, over Shopify's ${LIMIT} byte limit. Trim app/storefront-quiz.css.`);
  await writeFile(`extensions/dosha-quiz/assets/${name}`, output);
  console.log(`${name}: ${output.length} bytes`);
}
