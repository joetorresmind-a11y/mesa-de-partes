const fs = require("node:fs");
const assert = require("node:assert/strict");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  runTransaction,
  updateDoc,
} = require("firebase/firestore");
(async () => {
  const { publicRecord } = await import("../docs/domain.js");
  const env = await initializeTestEnvironment({
    projectId: "demo-mesa-tests",
    firestore: {
      host: "127.0.0.1",
      port: 8189,
      rules: fs.readFileSync(
        require("node:path").join(__dirname, "../firestore.rules"),
        "utf8",
      ),
    },
  });
  let checks = 0;
  const pass = () => checks++;
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await setDoc(doc(db, "admins", "admin"), { role: "admin" });
      for (const [uid, area, active] of [
        ["areaA", "Secretaría", true],
        ["areaB", "Administración", true],
        ["disabled", "Secretaría", false],
      ])
        await setDoc(doc(db, "staff", uid), {
          role: "area",
          name: uid,
          email: uid + "@example.invalid",
          area,
          active,
          createdAt: 1,
          updatedAt: 1,
          createdBy: "admin",
          updatedBy: "admin",
        });
    });
    const pub = env.unauthenticatedContext().firestore(),
      a = env.authenticatedContext("areaA").firestore(),
      b = env.authenticatedContext("areaB").firestore(),
      admin = env.authenticatedContext("admin").firestore(),
      outsider = env.authenticatedContext("outsider").firestore(),
      disabled = env.authenticatedContext("disabled").firestore();
    const key = "a".repeat(32),
      keyB = "b".repeat(32);
    const make = (id, k, area) => {
      const time = Date.now();
      return {
        schemaVersion: 2,
        id,
        time,
        updatedAt: time,
        applicant: {
          names: "Persona",
          lastName1: "Prueba",
          lastName2: "Ejemplo",
          dni: "12345678",
          mobile: "912345678",
          email: "prueba@example.invalid",
          address: "Domicilio de prueba 123",
        },
        sender: "Persona Prueba Ejemplo",
        subject: "Solicitud de prueba",
        description: "",
        type: "Solicitud",
        number: "",
        area,
        folios: 1,
        consent: true,
        filename: "prueba.pdf",
        storagePath: "supabase/attachments/" + k,
        internalNumber: "DOC-2026-" + String(id).padStart(6, "0"),
        state: "Recibido",
        responses: [],
        log: [
          {
            time,
            state: "Recibido",
            area,
            note: "Ingreso por mesa de partes.",
          },
        ],
      };
    };
    const register = (k, d) =>
      runTransaction(pub, async (t) => {
        await t.get(doc(pub, "config", "counter"));
        t.set(doc(pub, "config", "counter"), { value: d.id });
        t.set(doc(pub, "registroVinculo", "actual"), { value: d.id, token: k });
        t.set(doc(pub, "expedientes", k), d);
        t.set(doc(pub, "seguimiento", k), publicRecord(d));
      });
    await assertFails(setDoc(doc(pub, "config", "counter"), { value: 1 }));
    pass();
    await assertSucceeds(register(key, make(1, key, "Secretaría")));
    await assertSucceeds(register(keyB, make(2, keyB, "Administración")));
    pass();
    await assertFails(getDoc(doc(pub, "expedientes", key)));
    const track = await assertSucceeds(getDoc(doc(pub, "seguimiento", key)));
    assert(!("applicant" in track.data()));
    await assertFails(getDocs(collection(pub, "seguimiento")));
    pass();
    await assertSucceeds(
      getDocs(
        query(collection(a, "expedientes"), where("area", "==", "Secretaría")),
      ),
    );
    await assertFails(getDocs(collection(a, "expedientes")));
    await assertSucceeds(getDoc(doc(a, "expedientes", key)));
    await assertFails(getDoc(doc(a, "expedientes", keyB)));
    pass();
    await assertFails(getDoc(doc(disabled, "expedientes", key)));
    await assertFails(getDoc(doc(outsider, "expedientes", key)));
    pass();
    await assertFails(
      setDoc(doc(outsider, "admins", "outsider"), { role: "admin" }),
    );
    await assertFails(setDoc(doc(a, "staff", "areaA"), { role: "admin" }));
    pass();
    async function change(db, k, modify, mirror = true) {
      return runTransaction(db, async (t) => {
        const snap = await t.get(doc(db, "expedientes", k));
        const old = snap.data();
        const time = Math.max(Date.now(), old.updatedAt) + 1;
        const next = { ...old, state: "En trámite", updatedAt: time };
        modify(next, time);
        next.log = [
          ...old.log,
          { time, state: next.state, area: next.area, note: "" },
        ];
        t.set(doc(db, "expedientes", k), next);
        if (mirror) t.set(doc(db, "seguimiento", k), publicRecord(next));
      });
    }
    await assertSucceeds(
      change(a, key, (d, t) => {
        d.responses = [
          {
            id: "c".repeat(32),
            time: t,
            area: "Secretaría",
            authorName: "Persona del área",
            authorUid: "areaA",
            text: "Respuesta de prueba",
            filename: "respuesta.pdf",
            storagePath: "supabase/responses/" + key + "/" + "c".repeat(32),
          },
        ];
      }),
    );
    pass();
    await assertSucceeds(
      setDoc(doc(a, "notasInternas", key), {
        notes: { 1: { text: "Nota reservada", authorName: "Área A" } },
      }),
    );
    await assertFails(getDoc(doc(pub, "notasInternas", key)));
    await assertFails(getDoc(doc(b, "notasInternas", key)));
    pass();
    await assertFails(
      change(a, key, (d) => {
        d.area = "Administración";
      }),
    );
    await assertFails(
      change(a, key, (d) => {
        d.applicant.dni = "87654321";
      }),
    );
    await assertFails(change(a, key, () => {}, false));
    pass();
    await assertFails(
      change(a, key, (d, t) => {
        d.responses.push({
          id: "d".repeat(32),
          time: t,
          area: "Secretaría",
          authorName: "Falso",
          authorUid: "admin",
          text: "No permitido",
          filename: "",
          storagePath: "",
        });
      }),
    );
    pass();
    await assertFails(
      updateDoc(doc(a, "seguimiento", key), { dni: "12345678" }),
    );
    pass();
    await assertSucceeds(
      change(admin, key, (d) => {
        d.area = "Administración";
      }),
    );
    await assertFails(getDoc(doc(a, "expedientes", key)));
    await assertSucceeds(getDoc(doc(b, "expedientes", key)));
    pass();
    for (const mutate of [
      (d) => (d.applicant.dni = "12"),
      (d) => (d.applicant.mobile = "123"),
      (d) => (d.applicant.email = "correo"),
      (d) => (d.consent = false),
      (d) => (d.filename = ""),
    ]) {
      const k = "e".repeat(32);
      const d = make(3, k, "Secretaría");
      mutate(d);
      await assertFails(register(k, d));
    }
    pass();
    assert.equal((await getDoc(doc(pub, "config", "counter"))).data().value, 2);
    pass();
    await assertSucceeds(
      updateDoc(doc(admin, "staff", "areaB"), {
        active: false,
        updatedAt: Date.now(),
        updatedBy: "admin",
      }),
    );
    await assertFails(getDoc(doc(b, "expedientes", key)));
    pass();
    console.log(
      "OK:",
      checks,
      "grupos de comprobaciones de seguridad: áreas, cuentas, datos personales, respuestas, derivación y numeración.",
    );
  } finally {
    await env.cleanup();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
