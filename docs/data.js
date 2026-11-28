import {
  firebaseConfig,
  ADMIN_USERNAME,
  ADMIN_EMAIL,
} from "./firebase-config.js";
import { SUPABASE_FUNCTION_URL } from "./supabase-config.js";
import {
  validateRequest,
  validateFile,
  publicRecord,
  parseKey,
  randomKey,
  year,
  AREAS,
  STATES,
  canAccess,
} from "./domain.js";
let connection;
export function cloud() {
  return (connection ??= connect().catch((e) => {
    connection = null;
    throw e;
  }));
}
async function connect() {
  const sdk = await import("./vendor/firebase-runtime.js");
  const app =
    sdk.getApps().find((a) => a.name === "[DEFAULT]") ||
    sdk.initializeApp(firebaseConfig);
  const auth = sdk.getAuth(app);
  const db = sdk.initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false,
  });
  await new Promise((resolve, reject) => {
    const off = sdk.onAuthStateChanged(
      auth,
      () => {
        off();
        resolve();
      },
      reject,
    );
  });
  return createService(sdk, {
    auth,
    db,
    config: firebaseConfig,
    endpoint: SUPABASE_FUNCTION_URL,
  });
}
export function createService(
  s,
  { auth, db, config, endpoint, request = fetch },
) {
  const ref = (c, id) => s.doc(db, c, id);
  const read = async (c, id) => {
    const r = await s.getDoc(ref(c, id));
    return r.exists() ? { ...r.data(), _key: r.id || id } : null;
  };
  async function session() {
    const u = auth.currentUser;
    if (!u) return { role: "public" };
    const admin = await read("admins", u.uid);
    if (admin?.role === "admin" && admin.active !== false)
      return {
        role: "admin",
        uid: u.uid,
        email: u.email,
        name: "Administración",
        active: true,
      };
    const staff = await read("staff", u.uid);
    if (staff?.active && staff.role === "area") return { ...staff, uid: u.uid };
    return { role: "blocked", uid: u.uid, email: u.email };
  }
  async function member() {
    const me = await session();
    if (!["admin", "area"].includes(me.role))
      throw Error(
        "Tu cuenta no tiene un área activa. Comunícate con administración.",
      );
    return me;
  }
  async function adminOnly() {
    const me = await member();
    if (me.role !== "admin")
      throw Error("Esta herramienta está reservada para administración.");
    return me;
  }
  async function fileRequest(key, method, file, responseId) {
    if (!endpoint)
      throw Error(
        "El administrador debe configurar el servicio de archivos antes de recibir documentos.",
      );
    const headers = { "X-File-Key": key };
    if (responseId) headers["X-Response-Id"] = responseId;
    if (auth.currentUser && (method === "GET" || responseId))
      headers.Authorization = "Bearer " + (await auth.currentUser.getIdToken());
    if (file) {
      headers["Content-Type"] = file.type;
      headers["X-File-Name"] = encodeURIComponent(file.name.slice(0, 255));
    }
    let res;
    try {
      res = await request(endpoint.replace(/\/$/, "") + "/file", {
        method,
        headers,
        ...(file ? { body: file } : {}),
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      throw Error(
        "No se pudo conectar con los archivos. Comprueba Internet y vuelve a intentar.",
      );
    }
    if (!res.ok) {
      let body;
      try {
        body = await res.json();
      } catch {}
      throw Error(body?.error || "No se pudo acceder al archivo.");
    }
    return method === "GET" ? res.blob() : res.json();
  }
  async function register(input, file, key = randomKey()) {
    const v = validateRequest(input, file);
    const existing = await read("seguimiento", key);
    if (existing) return existing;
    await fileRequest(key, "PUT", file);
    const time = Date.now();
    let result;
    await s.runTransaction(db, async (t) => {
      const old = await t.get(ref("seguimiento", key));
      const c = await t.get(ref("config", "counter"));
      if (old.exists()) {
        result = { ...old.data(), _key: key };
        return;
      }
      const id = c.exists() ? Number(c.data().value) + 1 : 1;
      const record = {
        schemaVersion: 2,
        ...v,
        sender: [
          v.applicant.names,
          v.applicant.lastName1,
          v.applicant.lastName2,
        ].join(" "),
        id,
        time,
        updatedAt: time,
        filename: file.name.slice(0, 255),
        storagePath: "supabase/attachments/" + key,
        internalNumber: "DOC-" + year(time) + "-" + String(id).padStart(6, "0"),
        state: "Recibido",
        responses: [],
        log: [
          {
            time,
            state: "Recibido",
            area: v.area,
            note: "Ingreso por mesa de partes.",
          },
        ],
      };
      t.set(ref("config", "counter"), { value: id });
      t.set(ref("registroVinculo", "actual"), { value: id, token: key });
      t.set(ref("expedientes", key), record);
      t.set(ref("seguimiento", key), publicRecord(record));
      result = { ...publicRecord(record), _key: key };
    });
    return result;
  }
  async function lookup(keyText) {
    const { id, key } = parseKey(keyText);
    const r = await read("seguimiento", key);
    if (!r || r.id !== id)
      throw Error(
        "No se encontró el trámite. Revisa tu clave. Si el cargo es anterior a esta actualización, solicita al administrador habilitar su seguimiento.",
      );
    return r;
  }
  async function records() {
    const me = await member();
    const col = s.collection(db, "expedientes");
    const q =
      me.role === "admin" ? col : s.query(col, s.where("area", "==", me.area));
    const snap = await s.getDocs(q);
    return snap.docs
      .map((d) => ({ ...d.data(), _key: d.id }))
      .sort((a, b) => b.time - a.time);
  }
  async function record(key) {
    const me = await member();
    const r = await read("expedientes", key);
    if (!r || !canAccess(me, r))
      throw Error("Este expediente no pertenece a tu área o ya fue derivado.");
    return { ...r, notes: (await read("notasInternas", key))?.notes || {} };
  }
  async function act(
    key,
    {
      state,
      area,
      text = "",
      file = null,
      responseId = null,
      note = "",
      revision,
      respond = false,
    },
  ) {
    const me = await member(),
      original = await record(key);
    if (!STATES.includes(state)) throw Error("Estado no válido.");
    if (me.role !== "admin" && area !== original.area)
      throw Error("Solo administración puede derivar a otra área.");
    if (!AREAS.includes(area)) throw Error("Área no válida.");
    text = text.trim();
    note = note.trim();
    if (text.length > 6000 || note.length > 1000)
      throw Error("La respuesta o nota supera el máximo permitido.");
    const hasFile = validateFile(file);
    if (hasFile && !respond)
      throw Error("Los adjuntos se envían mediante una respuesta.");
    if (respond && !text && !hasFile)
      throw Error("Escribe una respuesta o adjunta un documento.");
    responseId = respond ? responseId || randomKey() : null;
    if (respond && original.responses?.some((r) => r.id === responseId)) return;
    if (hasFile) await fileRequest(key, "PUT", file, responseId);
    await s.runTransaction(db, async (t) => {
      const snap = await t.get(ref("expedientes", key));
      if (!snap.exists()) throw Error("Expediente no encontrado.");
      const d = snap.data();
      const notes = note ? await t.get(ref("notasInternas", key)) : null;
      if (respond && d.responses?.some((r) => r.id === responseId)) return;
      if (d.log.length !== revision)
        throw Error(
          "Otro usuario actualizó el expediente. Recarga el detalle antes de guardar.",
        );
      if (!canAccess(me, d)) throw Error("El expediente cambió de área.");
      const time = Math.max(Date.now(), d.updatedAt || d.time);
      const responses = [...(d.responses || [])];
      if (respond) {
        if (responses.length >= 40)
          throw Error("Se alcanzó el límite de respuestas de este expediente.");
        responses.push({
          id: responseId,
          time,
          area: d.area,
          authorName: me.name,
          authorUid: me.uid,
          text,
          filename: hasFile ? file.name.slice(0, 255) : "",
          storagePath: hasFile
            ? "supabase/responses/" + key + "/" + responseId
            : "",
        });
      }
      const next = {
        ...d,
        state,
        area,
        updatedAt: time,
        responses,
        log: [...d.log, { time, state, area, note: "" }],
      };
      t.update(ref("expedientes", key), {
        state,
        area,
        updatedAt: time,
        responses,
        log: next.log,
      });
      t.set(ref("seguimiento", key), publicRecord(next));
      if (note)
        t.set(ref("notasInternas", key), {
          notes: {
            ...(notes?.exists() ? notes.data().notes : {}),
            [String(time)]: { text: note, authorName: me.name },
          },
        });
    });
  }
  async function createStaff({ name, email, area, password, uid }) {
    const me = await adminOnly();
    name = name.trim();
    email = email.trim().toLowerCase();
    if (
      name.length < 3 ||
      name.length > 120 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      email.length > 180 ||
      !AREAS.includes(area)
    )
      throw Error("Completa nombre, correo y área válidos.");
    if (uid) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Error("UID no válido.");
      await s.setDoc(ref("staff", uid), {
        name,
        email,
        area,
        role: "area",
        active: true,
        createdAt: Date.now(),
        createdBy: me.uid,
        updatedAt: Date.now(),
        updatedBy: me.uid,
      });
      return { uid, email };
    }
    if (password.length < 12)
      throw Error("La contraseña inicial debe tener al menos 12 caracteres.");
    const secondary = s.initializeApp(config, "alta-" + randomKey());
    const secondaryAuth = s.initializeAuth(secondary, {
      persistence: s.inMemoryPersistence,
    });
    let user;
    try {
      user = (
        await s.createUserWithEmailAndPassword(secondaryAuth, email, password)
      ).user;
      await s.updateProfile(user, { displayName: name });
      await s.setDoc(ref("staff", user.uid), {
        name,
        email,
        area,
        role: "area",
        active: true,
        createdAt: Date.now(),
        createdBy: me.uid,
        updatedAt: Date.now(),
        updatedBy: me.uid,
      });
      return { uid: user.uid, email };
    } catch (error) {
      if (user)
        try {
          await s.deleteUser(user);
        } catch {
          throw Error(
            "La cuenta de acceso se creó, pero no se pudo asignar el área. Vincula su UID desde Firebase Authentication: " +
              user.uid,
          );
        }
      throw error;
    } finally {
      await s.signOut(secondaryAuth).catch(() => {});
      await s.deleteApp(secondary);
    }
  }
  async function staff() {
    await adminOnly();
    return (await s.getDocs(s.collection(db, "staff"))).docs.map((d) => ({
      ...d.data(),
      uid: d.id,
    }));
  }
  async function updateStaff(uid, { area, active }) {
    const me = await adminOnly();
    if (!AREAS.includes(area) || typeof active !== "boolean")
      throw Error("Configuración no válida.");
    await s.updateDoc(ref("staff", uid), {
      area,
      active,
      updatedAt: Date.now(),
      updatedBy: me.uid,
    });
  }
  async function migrate() {
    await adminOnly();
    const list = await records();
    let count = 0;
    for (const d of list) {
      await s.setDoc(ref("seguimiento", d._key), publicRecord(d));
      count++;
    }
    return count;
  }
  async function password(current, next) {
    if (next.length < 12)
      throw Error("La nueva contraseña debe tener al menos 12 caracteres.");
    await member();
    await s.reauthenticateWithCredential(
      auth.currentUser,
      s.EmailAuthProvider.credential(auth.currentUser.email, current),
    );
    await s.updatePassword(auth.currentUser, next);
  }
  return {
    session,
    register,
    lookup,
    records,
    record,
    act,
    staff,
    createStaff,
    updateStaff,
    migrate,
    password,
    async login(user, pw) {
      const email =
        user.trim().toLowerCase() === ADMIN_USERNAME
          ? ADMIN_EMAIL
          : user.trim();
      await s.signInWithEmailAndPassword(auth, email, pw);
      const me = await session();
      if (!["admin", "area"].includes(me.role)) {
        await s.signOut(auth);
        throw Error(
          "Tu cuenta no tiene acceso institucional activo. Consulta con administración.",
        );
      }
      return me;
    },
    logout: () => s.signOut(auth),
    reset: (email) =>
      s.sendPasswordResetEmail(
        auth,
        email.trim().toLowerCase() === ADMIN_USERNAME
          ? ADMIN_EMAIL
          : email.trim(),
      ),
    download: (r, response) => {
      const path = response?.storagePath || r.storagePath;
      if (!path?.startsWith("supabase/"))
        throw Error(
          "Este archivo pertenece al almacenamiento anterior y requiere migración.",
        );
      return fileRequest(r._key, "GET", null, response?.id);
    },
    async diagnostics() {
      await adminOnly();
      await s.getDoc(ref("config", "counter"));
      const res = await request(endpoint.replace(/\/$/, "") + "/health", {
        signal: AbortSignal.timeout(15000),
      });
      const result = await res.json();
      if (!res.ok || !result.ok)
        throw Error(
          "La base de datos respondió, pero debes revisar el depósito de archivos.",
        );
      if (result.version !== 8)
        throw Error(
          "El servicio de archivos sigue en otra versión. Publica la función adjuntos incluida en esta actualización.",
        );
      return "Firestore y Supabase respondieron correctamente.";
    },
  };
}
