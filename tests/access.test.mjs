import test from "node:test";
import assert from "node:assert/strict";
import { authorizeStaff } from "../supabase/functions/adjuntos/firebase-access.mjs";
import handler from "../supabase/functions/adjuntos/handler.mjs";
const key = "a".repeat(32),
  reply = "b".repeat(32),
  origin = "https://example.com";
const jwt = (uid) =>
  [
    "header",
    Buffer.from(
      JSON.stringify({
        sub: uid,
        aud: "mesa-de-partes-53521",
        iss: "https://securetoken.google.com/mesa-de-partes-53521",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "signature",
  ].join(".");
const fields = (x) => ({
  fields: Object.fromEntries(
    Object.entries(x).map(([k, v]) => [
      k,
      typeof v === "boolean" ? { booleanValue: v } : { stringValue: v },
    ]),
  ),
});
const request = (uid, method = "PUT") =>
  new Request("https://test.supabase.co/functions/v1/adjuntos/file", {
    method,
    headers: {
      Origin: origin,
      "X-File-Key": key,
      "X-Response-Id": reply,
      "Content-Type": "application/pdf",
      ...(uid ? { Authorization: "Bearer " + jwt(uid) } : {}),
    },
    ...(method === "PUT" ? { body: "%PDF-1.7" } : {}),
  });
function server({
  area = "Secretaría",
  recordArea = "Secretaría",
  active = true,
  valid = true,
} = {}) {
  return async (url) => {
    if (!valid)
      return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (url.includes("/admins/")) return new Response(null, { status: 404 });
    if (url.includes("/staff/"))
      return Response.json(fields({ role: "area", area, active }));
    return Response.json(fields({ area: recordArea }));
  };
}
test("Respuesta exige sesión y verificación remota del token, no basta un payload firmado falsamente", async () => {
  await assert.rejects(
    authorizeStaff(request(), key, server()),
    /Inicia sesión/,
  );
  await assert.rejects(
    authorizeStaff(request("usuario"), key, server({ valid: false })),
    /Sesión/,
  );
});
test("Respuesta rechaza otras áreas y perfiles desactivados", async () => {
  await assert.rejects(
    authorizeStaff(request("u"), key, server({ recordArea: "Administración" })),
    /No tienes acceso/,
  );
  await assert.rejects(
    authorizeStaff(request("u"), key, server({ active: false })),
    /No tienes acceso/,
  );
  assert.equal(
    (await authorizeStaff(request("u"), key, server())).area,
    "Secretaría",
  );
});
test("La API bloquea la carga antes de escribir al bucket si no hay autorización", async () => {
  let writes = 0;
  const env = {
    ALLOWED_ORIGINS: origin,
    DOCUMENTS: {
      put: async () => {
        writes++;
        return {};
      },
    },
    FIREBASE_FETCH: server({ recordArea: "Administración" }),
  };
  assert.equal((await handler.fetch(request("u"), env)).status, 403);
  assert.equal((await handler.fetch(request(), env)).status, 401);
  assert.equal(writes, 0);
});
test("La API permite respuesta del área autorizada y conserva su ruta", async () => {
  let stored;
  const env = {
    ALLOWED_ORIGINS: origin,
    DOCUMENTS: {
      put: async (path) => {
        stored = path;
        return {};
      },
    },
    FIREBASE_FETCH: server(),
  };
  assert.equal((await handler.fetch(request("u"), env)).status, 201);
  assert.equal(stored, "responses/" + key + "/" + reply);
});
