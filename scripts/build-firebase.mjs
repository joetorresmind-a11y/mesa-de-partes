import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(new URL("../docs/vendor/", import.meta.url), { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: ["scripts/firebase-entry.mjs"],
  outfile: "docs/vendor/firebase-runtime.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "eof",
  metafile: true,
});
for (const output of Object.values(result.metafile.outputs))
  if (output.imports.length)
    throw Error("La biblioteca debe incluir todas sus dependencias.");
await writeFile(
  new URL("../docs/vendor/FIREBASE-LICENSE.txt", import.meta.url),
  await readFile(new URL("./licenses/FIREBASE-LICENSE.txt", import.meta.url)),
);
console.log(
  "Firebase compilado en docs/vendor/firebase-runtime.js, sin importaciones externas.",
);
