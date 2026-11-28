import test from "node:test";
import assert from "node:assert/strict";
import { createService } from "../docs/data.js";
import { publicRecord, validateApplicant, csv } from "../docs/domain.js";
function setup(health = { ok: true, version: 8 }) {
  const docs = new Map(),
    auth = { currentUser: null },
    uploads = [];
  const snapshot = (k) => ({
    exists: () => docs.has(k),
    data: () => structuredClone(docs.get(k)),
    id: k.split("/")[1],
  });
  const s = {
    doc: (_, c, id) => c + "/" + id,
    collection: (_, c) => c,
    where: (...v) => v,
    query: (c, w) => ({ c, w }),
    getDoc: async (k) => snapshot(k),
    getDocs: async (q) => ({
      docs: [...docs]
        .filter(
          ([k, v]) =>
            k.startsWith((q.c || q) + "/") && (!q.w || v[q.w[0]] === q.w[2]),
        )
        .map(([k]) => snapshot(k)),
    }),
    setDoc: async (k, v) => docs.set(k, structuredClone(v)),
    updateDoc: async (k, v) => docs.set(k, { ...docs.get(k), ...v }),
    runTransaction: async (_, fn) => {
      const pending = [];
      await fn({
        get: async (k) => snapshot(k),
        set: (k, v) => pending.push([k, v]),
        update: (k, v) => pending.push([k, { ...docs.get(k), ...v }]),
      });
      for (const [k, v] of pending) docs.set(k, structuredClone(v));
    },
  };
  const api = createService(s, {
    auth,
    db: {},
    config: {},
    endpoint: "https://test.supabase.co/functions/v1/adjuntos",
    request: async (url, options) => {
      uploads.push({ url, options });
      return Response.json(url.endsWith("/health") ? health : { ok: true });
    },
  });
  const user = (uid, area) => {
    auth.currentUser = {
      uid,
      email: uid + "@example.invalid",
      getIdToken: async () => uid + ".jwt",
    };
    docs.set("staff/" + uid, { role: "area", area, name: uid, active: true });
  };
  return { api, docs, auth, s, uploads, user };
}
const input = () => ({
  applicant: {
    names: "Joel",
    lastName1: "Prueba",
    lastName2: "Ejemplo",
    dni: "12345678",
    mobile: "912345678",
    email: "persona@example.invalid",
    address: "Domicilio de prueba 123",
  },
  subject: "Certificado de estudios",
  description: "Solicitud",
  type: "Solicitud",
  number: "",
  area: "Secretaría",
  folios: 1,
  consent: true,
});
const file = () =>
  new File(["%PDF-1.7 prueba"], "solicitud.pdf", { type: "application/pdf" });
test("Diagnóstico distingue la función anterior y comprueba la versión de respuestas", async () => {
  const old = setup({ ok: true });
  old.auth.currentUser = { uid: "admin" };
  old.docs.set("admins/admin", { role: "admin" });
  await assert.rejects(old.api.diagnostics(), /otra versión/);
  const current = setup();
  current.auth.currentUser = { uid: "admin" };
  current.docs.set("admins/admin", { role: "admin" });
  assert.match(await current.api.diagnostics(), /respondieron correctamente/);
});
test("Registro completo crea vista pública sin datos de contacto y reintento idempotente", async () => {
  const h = setup(),
    key = "a".repeat(32);
  const r = await h.api.register(input(), file(), key);
  assert.equal(r.id, 1);
  assert.equal(h.docs.get("expedientes/" + key).applicant.dni, "12345678");
  const pub = h.docs.get("seguimiento/" + key);
  for (const f of [
    "applicant",
    "dni",
    "mobile",
    "email",
    "address",
    "description",
    "log",
  ])
    assert(!(f in pub));
  await h.api.register(input(), file(), key);
  assert.equal(h.docs.get("config/counter").value, 1);
  assert.equal(h.uploads.length, 1);
  assert.equal((await h.api.lookup("1-" + key)).id, 1);
});
test("Datos obligatorios y archivo se validan antes de consumir número o cargar", async () => {
  const h = setup();
  for (const [name, value] of [
    ["dni", "123"],
    ["mobile", "456"],
    ["email", "x"],
    ["lastName2", ""],
  ]) {
    const v = input();
    v.applicant[name] = value;
    await assert.rejects(h.api.register(v, file()));
  }
  await assert.rejects(h.api.register(input(), null));
  assert.equal(h.docs.size, 0);
  assert.equal(h.uploads.length, 0);
});
test("Bandeja del área consulta solo su área; cambio de área se rechaza", async () => {
  const h = setup(),
    key = "b".repeat(32);
  await h.api.register(input(), file(), key);
  await h.api.register(
    { ...input(), area: "Administración" },
    file(),
    "c".repeat(32),
  );
  h.user("area", "Secretaría");
  assert.equal((await h.api.records()).length, 1);
  await assert.rejects(h.api.record("c".repeat(32)));
  await assert.rejects(
    h.api.act(key, { state: "Atendido", area: "Administración", revision: 1 }),
  );
});
test("Respuesta con adjunto se publica y el reintento no duplica respuestas", async () => {
  const h = setup(),
    key = "d".repeat(32),
    reply = "f".repeat(32);
  await h.api.register(input(), file(), key);
  h.user("area", "Secretaría");
  const action = {
    state: "Atendido",
    area: "Secretaría",
    text: "Respuesta para el solicitante",
    file: file(),
    responseId: reply,
    revision: 1,
    respond: true,
  };
  await h.api.act(key, action);
  assert.equal(h.docs.get("seguimiento/" + key).responses.length, 1);
  assert.equal(h.uploads.at(-1).options.headers["X-Response-Id"], reply);
  assert(h.uploads.at(-1).options.headers.Authorization);
  await h.api.act(key, action);
  assert.equal(h.docs.get("seguimiento/" + key).responses.length, 1);
  assert.equal(h.uploads.length, 2);
});
test("Notas se mantienen privadas y revisión concurrente bloquea cambios", async () => {
  const h = setup(),
    key = "e".repeat(32);
  await h.api.register(input(), file(), key);
  h.user("area", "Secretaría");
  await h.api.act(key, {
    state: "En trámite",
    area: "Secretaría",
    note: "Nota interna",
    revision: 1,
  });
  assert(h.docs.get("notasInternas/" + key));
  assert(
    !JSON.stringify(h.docs.get("seguimiento/" + key)).includes("Nota interna"),
  );
  await assert.rejects(
    h.api.act(key, { state: "Atendido", area: "Secretaría", revision: 1 }),
    /Otro usuario/,
  );
});
test("Alta secundaria mantiene la sesión de administración", async () => {
  const h = setup();
  h.auth.currentUser = { uid: "admin" };
  h.docs.set("admins/admin", { role: "admin" });
  let created = 0,
    deleted = 0;
  const secondaryAuth = {};
  Object.assign(h.s, {
    initializeApp: () => ({ name: "secondary" }),
    initializeAuth: () => secondaryAuth,
    inMemoryPersistence: {},
    createUserWithEmailAndPassword: async () => {
      created++;
      return { user: { uid: "nuevo" } };
    },
    updateProfile: async () => {},
    signOut: async (auth) => assert.equal(auth, secondaryAuth),
    deleteApp: async () => {
      deleted++;
    },
    deleteUser: async () => {},
  });
  await h.api.createStaff({
    name: "Persona del área",
    email: "nueva@example.invalid",
    area: "Secretaría",
    password: "Prueba-larga-123",
  });
  assert.equal(h.auth.currentUser.uid, "admin");
  assert.equal(created, 1);
  assert.equal(deleted, 1);
  assert.equal(h.docs.get("staff/nuevo").role, "area");
  assert(!("password" in h.docs.get("staff/nuevo")));
});
test("CSV neutraliza fórmulas y exporta solo los registros recibidos", () => {
  assert(
    csv([
      {
        id: 1,
        time: Date.now(),
        sender: '=HYPERLINK("mal")',
        subject: "x",
        area: "Secretaría",
        state: "Recibido",
      },
    ]).includes('" =HYPERLINK'),
  );
});
