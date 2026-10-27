import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

// Deep Dosha scoring follows the PRANA spec: five rules in order, and every one of the 190 possible
// A/B/C totals for 18 answers returns exactly one of the seven results.
const compiled = await transform(await readFile("app/dosha-content.ts", "utf8"), { loader: "ts", format: "esm" });
const { doshaFromCounts, DOSHA_CONTENT } = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`);

const spec = { vata: "vata", pitta: "pitta", kapha: "kapha", tridoshic: "balanced", vata_pitta: "dual-vata-pitta", vata_kapha: "dual-vata-kapha", pitta_kapha: "dual-kapha-pitta" };
const cases = [[13, 3, 2, "vata"], [9, 7, 2, "vata_pitta"], [11, 4, 3, "vata"], [6, 6, 6, "tridoshic"], [7, 4, 7, "vata_kapha"], [2, 8, 8, "pitta_kapha"], [4, 5, 9, "kapha"]];
for (const [vata, pitta, kapha, expected] of cases) assert.equal(doshaFromCounts({ vata, pitta, kapha }), spec[expected], `${vata}/${pitta}/${kapha}`);

const seen = new Set();
let combinations = 0;
for (let vata = 0; vata <= 18; vata++) for (let pitta = 0; pitta <= 18 - vata; pitta++) {
  const kapha = 18 - vata - pitta;
  const result = doshaFromCounts({ vata, pitta, kapha });
  assert.ok(DOSHA_CONTENT[result], `no content for ${result} (${vata}/${pitta}/${kapha})`);
  seen.add(result);
  combinations++;
}
assert.equal(combinations, 190);
assert.equal(seen.size, 7, `results reachable: ${[...seen].join(", ")}`);
console.log("PASS: spec test cases, all 190 answer totals give one result, and all seven results are reachable.");
