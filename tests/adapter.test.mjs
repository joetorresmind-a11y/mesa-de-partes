import test from "node:test";
import assert from "node:assert/strict";
import handler from "../supabase/functions/adjuntos/handler.mjs";
import { createStorage } from "../supabase/functions/adjuntos/storage.mjs";
test("Adaptador Supabase: descarga privada, reintento y bloqueo de sobrescritura", async () => {
  const objects = new Map();
  const client = {
    storage: {
      from(name) {
        assert.equal(name, "mesa-partes-adjuntos");
        return {
          async upload(key, bytes, opts) {
            assert.equal(opts.upsert, false);
            if (objects.has(key)) return { error: { statusCode: "409" } };
            objects.set(key, new Blob([bytes], { type: opts.contentType }));
            return { data: { path: key } };
          },
          async download(key) {
            return objects.has(key)
              ? { data: objects.get(key) }
              : { error: { statusCode: "404" } };
          },
        };
      },
    },
  };
  const env = {
    DOCUMENTS: createStorage(client),
    ALLOWED_ORIGINS: "https://example.com",
  };
  const call = (method, body) =>
    handler.fetch(
      new Request("https://project.supabase.co/functions/v1/adjuntos/file", {
        method,
        headers: {
          Origin: "https://example.com",
          "X-File-Key": "f".repeat(32),
          "Content-Type": "application/pdf",
        },
        ...(body ? { body } : {}),
      }),
      env,
    );
  assert.equal((await call("GET")).status, 404);
  assert.equal((await call("PUT", "%PDF-1.7 test")).status, 201);
  assert.equal((await call("PUT", "%PDF-1.7 test")).status, 200);
  assert.equal((await call("PUT", "%PDF-1.7 other")).status, 409);
  assert.equal(await (await call("GET")).text(), "%PDF-1.7 test");
});
test("Supabase: errores de permisos no se confunden con archivo ausente", async () => {
  const storage = createStorage({
    storage: {
      from: () => ({
        download: async () => ({ error: new Error("permission denied") }),
        upload: async () => ({ error: new Error("permission denied") }),
      }),
    },
  });
  await assert.rejects(storage.get("attachments/a"), /permission denied/);
  await assert.rejects(
    storage.put("attachments/a", new Uint8Array(), {
      httpMetadata: { contentType: "application/pdf" },
    }),
    /permission denied/,
  );
});
