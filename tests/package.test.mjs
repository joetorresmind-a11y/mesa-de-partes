import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
test("Las rutas publicadas funcionan bajo el nombre del repositorio", async () => {
  const html = await read("docs/index.html");
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const path = m[1];
    if (/^([a-z]+:|#)/.test(path)) continue;
    assert(!path.startsWith("/"), "No debe depender de la raíz del dominio");
    await readFile(new URL("../docs/" + path, import.meta.url));
  }
});
test("El artefacto público no contiene el servidor anterior ni las credenciales locales", async () => {
  const files = await readdir(new URL("../docs/", import.meta.url));
  assert(!files.some((x) => /administrador|worker|servidor|legacy/.test(x)));
  const js = await read("docs/app.js");
  assert(!js.includes("fetch('/api/"));
  assert(!js.includes("administrador-inicial.json"));
});
test("GitHub solo publica docs y Firebase apunta al mismo contenido", async () => {
  const wf = await read(".github/workflows/pages.yml");
  assert(wf.includes("path: docs"));
  assert.equal(JSON.parse(await read("firebase.json")).hosting.public, "docs");
});

test("La raíz abre el portal y conserva el fragmento de navegación", async () => {
  const html = await read("index.html");
  assert(html.includes("new URL('./docs/',location.href)"));
  assert(html.includes("location.hash"));
  assert(html.includes('href="./docs/"'));
  await readFile(new URL("../.nojekyll", import.meta.url));
});
