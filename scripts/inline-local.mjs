import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

// Tests load server modules from data: URLs, where relative imports cannot resolve. This swaps the app's small
// self-contained helper modules for data: URLs of their compiled code.
const LOCAL = ["./dosha-content", "./report-email.server"];
export async function inlineLocalImports(source) {
  for (const name of LOCAL) {
    const pattern = new RegExp(`from ["']${name.replace(".", "\.")}["']`, "g");
    if (!pattern.test(source)) continue;
    const code = (await transform(await readFile(`app/${name.slice(2)}.ts`, "utf8"), { loader: "ts", format: "esm" })).code;
    source = source.replace(pattern, `from "data:text/javascript;base64,${Buffer.from(code).toString("base64")}"`);
  }
  return source;
}
