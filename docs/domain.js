export const AREAS = [
  "Mesa de partes",
  "Dirección general",
  "Administración",
  "Secretaría",
  "Calidad",
  "Secretaría académica",
  "Unidad académica",
  "Bienestar y empleabilidad",
  "Investigación e innovación tecnológica",
  "Construcción Civil",
  "Producción Agropecuaria",
  "Arquitectura de Plataformas y Servicios de Tecnologías de la Información",
];
export const STATES = [
  "Recibido",
  "En trámite",
  "Observado",
  "Atendido",
  "Archivado",
];
export const TYPES = ["Solicitud", "Oficio", "Carta", "Informe", "Otro"];
export const MAX_FILE = 10 * 1024 * 1024;
export const TOKEN = /^[a-f0-9]{32}$/;
export const randomKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const date = (t) =>
  new Date(t).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "medium",
    timeStyle: "short",
  });
export const year = (t) =>
  new Date(t).toLocaleDateString("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
  });
export const code = (r) =>
  "MST-" + year(r.time) + "-" + String(r.id).padStart(6, "0");
export const trackingKey = (r) => r.id + "-" + r._key;
export function parseKey(text) {
  const m = String(text)
    .trim()
    .match(/^(\d+)-([a-f0-9]{32})$/);
  if (!m || !Number.isSafeInteger(Number(m[1])) || Number(m[1]) < 1)
    throw Error(
      "Ingresa la clave completa que aparece en tu cargo de recepción.",
    );
  return { id: Number(m[1]), key: m[2] };
}
export function validateFile(file, required = false) {
  if (!file || !file.size) {
    if (required) throw Error("Adjunta el documento que deseas presentar.");
    return false;
  }
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type))
    throw Error("El documento debe ser PDF, JPG o PNG.");
  if (file.size > MAX_FILE)
    throw Error("El documento supera el límite de 10 MB.");
  return true;
}
const text = (v, max, min, label) => {
  const s = String(v ?? "").trim();
  if (s.length < min || s.length > max)
    throw Error("Revisa el campo " + label + ".");
  return s;
};
export function validateApplicant(a) {
  const r = {
    names: text(a.names, 80, 2, "nombres"),
    lastName1: text(a.lastName1, 60, 2, "apellido paterno"),
    lastName2: text(a.lastName2, 60, 2, "apellido materno"),
    dni: String(a.dni ?? "").trim(),
    mobile: String(a.mobile ?? "").trim(),
    email: String(a.email ?? "")
      .trim()
      .toLowerCase(),
    address: text(a.address, 240, 8, "domicilio"),
  };
  if (!/^\d{8}$/.test(r.dni)) throw Error("El DNI debe tener 8 dígitos.");
  if (!/^9\d{8}$/.test(r.mobile))
    throw Error("Ingresa un celular peruano de 9 dígitos que empiece con 9.");
  if (r.email.length > 180 || !/^\S+@[^\s@]+\.[^\s@]+$/.test(r.email))
    throw Error("Ingresa un correo electrónico válido.");
  return r;
}
export function validateRequest(input, file) {
  const applicant = validateApplicant(input.applicant || {});
  const r = {
    applicant,
    subject: text(input.subject, 220, 5, "asunto"),
    description: String(input.description || "").trim(),
    type: input.type,
    number: String(input.number || "").trim(),
    area: input.area,
    folios: Number(input.folios),
    consent: input.consent === true,
  };
  if (!TYPES.includes(r.type) || !AREAS.includes(r.area))
    throw Error("Selecciona el tipo de documento y el área de destino.");
  if (r.description.length > 3000 || r.number.length > 70)
    throw Error("Reduce la extensión de la descripción o referencia.");
  if (!Number.isInteger(r.folios) || r.folios < 1 || r.folios > 99999)
    throw Error("Indica un número de folios válido.");
  if (!r.consent)
    throw Error(
      "Debes confirmar la declaración de datos y el aviso de privacidad.",
    );
  validateFile(file, true);
  return r;
}
// El seguimiento nunca incluye DNI, correo, celular, domicilio ni notas internas.
export function publicRecord(d) {
  return {
    id: d.id,
    time: d.time,
    updatedAt: d.updatedAt || d.time,
    subject: d.subject,
    sender: d.sender,
    type: d.type,
    area: d.area,
    state: d.state,
    internalNumber: d.internalNumber,
    filename: d.filename || "",
    storagePath: d.storagePath || "",
    responses: d.responses || [],
  };
}
export const canAccess = (session, record) =>
  session?.role === "admin" ||
  (session?.role === "area" &&
    session.active !== false &&
    session.area === record.area);
export function csv(records) {
  const cell = (x) =>
    '"' +
    String(x ?? "")
      .replace(/^[=+@\-\t\r]/, " $&")
      .replace(/"/g, '""') +
    '"';
  return (
    "\uFEFF" +
    [
      ["Expediente", "Fecha", "Remitente", "Asunto", "Área", "Estado"],
      ...records.map((r) => [
        code(r),
        date(r.time),
        r.sender,
        r.subject,
        r.area,
        r.state,
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
export function friendly(error) {
  const codes = {
    "permission-denied":
      "No tienes permiso para esta operación. Verifica tu área o solicita al administrador revisar las reglas de acceso.",
    unavailable:
      "No se pudo conectar con la base de datos. Comprueba Internet y vuelve a intentar.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use":
      "Ese correo ya tiene una cuenta. Puedes vincularla utilizando su UID de Firebase Authentication.",
    "auth/weak-password": "Usa una contraseña de al menos 12 caracteres.",
    "auth/too-many-requests":
      "Se realizaron demasiados intentos. Espera unos minutos.",
    "auth/operation-not-allowed":
      "El administrador debe habilitar Correo/contraseña en Firebase Authentication.",
    "auth/network-request-failed":
      "No se pudo conectar con el servicio de acceso. Comprueba Internet.",
    "auth/requires-recent-login":
      "Vuelve a iniciar sesión para realizar esta operación.",
  };
  if (
    /dynamically imported module|module script failed/i.test(
      error?.message || "",
    )
  )
    return "No se pudo cargar la conexión del sistema. Recarga la página y verifica que se haya publicado la carpeta vendor.";
  return (
    codes[error?.code] || error?.message || "No se pudo completar la operación."
  );
}
