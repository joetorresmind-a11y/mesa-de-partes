import test from "node:test";
import assert from "node:assert/strict";
import worker from "../supabase/functions/adjuntos/handler.mjs";
const origin = "https://joetorresmind-a11y.github.io",
  token = "a".repeat(32);
function setup() {
  const objects = new Map();
  const env = {
    ALLOWED_ORIGINS: origin,
    DOCUMENTS: {
      async put(key, content, options) {
        assert.equal(options.onlyIf.etagDoesNotMatch, "*");
        if (objects.has(key)) return null;
        const obj = { bytes: new Uint8Array(content), ...options };
        objects.set(key, obj);
        return obj;
      },
      async head(key) {
        return objects.get(key) || null;
      },
      async get(key) {
        const obj = objects.get(key);
        return obj ? { ...obj, body: obj.bytes } : null;
      },
    },
  };
  const request = (
    method = "PUT",
    body = "%PDF-1.7\nPrueba",
    headers = {},
    path = "/file",
  ) =>
    worker.fetch(
      new Request("https://storage.example/functions/v1/adjuntos" + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/pdf",
          "X-File-Key": token,
          "X-File-Name": encodeURIComponent("certificado.pdf"),
          ...headers,
        },
        ...(["PUT", "POST"].includes(method) ? { body } : {}),
      }),
      env,
    );
  return { request, objects };
}
test("Supabase sube y descarga PDF con cabeceras privadas", async () => {
  const h = setup();
  assert.equal((await h.request()).status, 201);
  const r = await h.request("GET");
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "%PDF-1.7\nPrueba");
  assert.match(r.headers.get("Content-Disposition"), /^attachment;/);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
});
test("Supabase reintento idéntico no duplica; contenido distinto no sobrescribe", async () => {
  const h = setup();
  await h.request();
  assert.equal((await h.request()).status, 200);
  assert.equal((await h.request("PUT", "%PDF-1.7\nOtro")).status, 409);
  assert.equal(h.objects.size, 1);
});
test("Supabase rechaza MIME falso, tamaño excesivo y archivo vacío", async () => {
  const h = setup();
  assert.equal((await h.request("PUT", "<script>")).status, 415);
  assert.equal(
    (
      await h.request("PUT", "%PDF-1.7", {
        "Content-Length": String(11 * 1024 * 1024),
      })
    ).status,
    413,
  );
  assert.equal((await h.request("PUT", "")).status, 400);
  assert.equal(h.objects.size, 0);
});
test("Supabase restringe origen y token; no expone lista ni eliminación", async () => {
  const h = setup();
  assert.equal(
    (await h.request("GET", null, { Origin: "https://otro.example" })).status,
    403,
  );
  assert.equal(
    (await h.request("GET", null, { "X-File-Key": "incorrecta" })).status,
    403,
  );
  assert.equal((await h.request("GET", null, {}, "/")).status, 404);
  assert.equal((await h.request("DELETE")).status, 405);
});
test("Supabase permite preflight del sitio autorizado", async () => {
  const h = setup();
  const r = await h.request("OPTIONS");
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(r.headers.get("Access-Control-Allow-Credentials"), null);
});
