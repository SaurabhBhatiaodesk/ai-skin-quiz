// Regression checks for detecting quiz app blocks in the live theme.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
const code = (await transform(await readFile("app/theme.server.ts", "utf8"), { loader: "ts", format: "esm" })).code;
const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const index = `/* Auto-generated */ {"sections":{"main":{"type":"apps","blocks":{"a":{"type":"shopify:\/\/apps\/ai-skin-quiz\/blocks\/dosha-quiz\/abc","settings":{"quiz_code":"john-smith"}},"b":{"type":"shopify://apps/ai-skin-quiz/blocks/single-quiz/def","settings":{"quiz_code":"dosha-quiz"}},"c":{"type":"shopify://apps/ai-skin-quiz/blocks/skin-scan/x","disabled":true,"settings":{"quiz_code":"scan"}}}}}}`;
const admin = { graphql: async () => ({ json: async () => ({ data: { themes: { nodes: [{ name: "Dawn", files: { nodes: [{ body: { content: index } }, { body: { content: "{}" } }] } }] } } }) }) };
const status = await api.themeStatus(admin);
assert.equal(status.checked, true);
assert.equal(status.blocks.length, 2);
assert.equal(api.isQuizLive(status, { handle: "john-smith", layout: "three" }, false), true);
assert.equal(api.isQuizLive(status, { handle: "test", layout: "single" }, true), true);
assert.equal(api.isQuizLive(status, { handle: "test", layout: "single" }, false), false);
assert.equal(api.isQuizLive(status, { handle: "scan", layout: "scan" }, true), false);
const denied = await api.themeStatus({ graphql: async () => ({ json: async () => ({ errors: [{ message: "Access denied" }] }) }) });
assert.equal(denied.checked, false);
console.log("Passed: theme block detection");

const disabledSection = JSON.stringify({sections:{main:{disabled:true,blocks:{quiz:{type:"shopify://apps/ai-skin-quiz/blocks/dosha-quiz/abc",settings:{quiz_code:"john-smith"}}}}}});
const disabledStatus = await api.themeStatus({graphql:async()=>({json:async()=>({data:{themes:{nodes:[{name:"Test",files:{nodes:[{body:{content:disabledSection}}]}}]}}})})});
assert.equal(disabledStatus.blocks.length,0);
console.log("Passed: blocks inside disabled sections are not live.");
