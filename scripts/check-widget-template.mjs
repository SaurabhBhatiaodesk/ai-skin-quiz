import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

// The admin preview and the app-proxy embed render the theme snippet themselves: no Liquid may leak into the page,
// the brand name is filled in, and the privacy links appear only when a privacy URL is known.
const code = (await transform(await readFile("app/widget-template.server.ts", "utf8"), { loader: "ts", format: "esm" })).code;
const { renderWidgetTemplate } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const template = await readFile("extensions/dosha-quiz/snippets/quiz-widget.liquid", "utf8");
const withPrivacy = renderWidgetTemplate(template, { "block.id": "t", brand_name: "<Brand>", privacy_url: "/policies/privacy-policy" });
assert.ok(!/\{[%{]|enddoc|@param/.test(withPrivacy), "Liquid left in rendered widget");
assert.ok(withPrivacy.trimStart().startsWith("<"), "rendered widget starts with markup");
assert.ok(withPrivacy.includes("&lt;Brand&gt;") && !withPrivacy.includes("<Brand>"));
assert.equal((withPrivacy.match(/href="\/policies\/privacy-policy"/g) || []).length, 2);
const withoutPrivacy = renderWidgetTemplate(template, { "block.id": "t", brand_name: "B", privacy_url: "" });
assert.ok(!/privacy policy/i.test(withoutPrivacy) && !/\{[%{]/.test(withoutPrivacy));
console.log("PASS: the widget snippet renders outside Shopify with no Liquid left, escaped brand, optional privacy links.");
