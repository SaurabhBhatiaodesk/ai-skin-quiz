import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

// The two shipped stylesheets are the source, minified and split in order: together they equal the whole source.
const minify = async (css) => (await transform(css, { loader: "css", minify: true })).code;
const strip = (css) => css.replace(/^\/\*![^]*?\*\/\r?\n/, "");
const whole = await minify(await readFile("app/storefront-quiz.css", "utf8"));
const parts = await Promise.all(["dosha-quiz.css", "dosha-quiz-extra.css"].map((name) => readFile(`extensions/dosha-quiz/assets/${name}`, "utf8")));
for (const part of parts) assert.ok(part.length <= 100000, "stylesheet over 100 KB");
assert.equal(await minify(parts.map(strip).join("")), whole, "assets are stale: run npm run build:widget");
const snippet = await readFile("extensions/dosha-quiz/snippets/quiz-widget.liquid", "utf8");
assert.ok(snippet.includes("{{ 'dosha-quiz-extra.css' | asset_url | stylesheet_tag }}"));
console.log("PASS: shipped stylesheets match app/storefront-quiz.css, in order, each under 100 KB.");
