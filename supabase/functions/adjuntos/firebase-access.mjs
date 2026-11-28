const PROJECT = "mesa-de-partes-53521";
function deny(message = "No tienes acceso a este expediente.", status = 403) {
  throw Object.assign(new Error(message), { status });
}
function field(doc, name) {
  const f = doc?.fields?.[name];
  return f?.stringValue ?? f?.booleanValue;
}
export async function authorizeStaff(request, key, fetcher = fetch) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer "))
    deny("Inicia sesión para adjuntar una respuesta.", 401);
  let claims;
  try {
    const part = authorization.slice(7).split(".")[1];
    claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    deny("Sesión no válida. Vuelve a ingresar.", 401);
  }
  if (
    claims.aud !== PROJECT ||
    claims.iss !== "https://securetoken.google.com/" + PROJECT ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    claims.sub.length > 128 ||
    claims.exp * 1000 <= Date.now()
  )
    deny("Sesión no válida o vencida.", 401);
  // El payload solo identifica la ruta. Firestore valida firma, token y Security Rules.
  const base =
    "https://firestore.googleapis.com/v1/projects/" +
    PROJECT +
    "/databases/(default)/documents/";
  async function get(path) {
    const res = await fetcher(base + path, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      if (res.status === 401) deny("Sesión vencida. Vuelve a ingresar.", 401);
      if (res.status === 403) deny();
      deny("No se pudo comprobar el acceso. Inténtalo nuevamente.", 503);
    }
    return res.json();
  }
  const uid = encodeURIComponent(claims.sub);
  const admin = await get("admins/" + uid);
  let profile = admin;
  const isAdmin =
    field(admin, "role") === "admin" && field(admin, "active") !== false;
  if (!isAdmin) {
    profile = await get("staff/" + uid);
    if (field(profile, "role") !== "area" || field(profile, "active") !== true)
      deny();
  }
  const record = await get("expedientes/" + key);
  if (!record) deny("Expediente no encontrado.", 404);
  if (!isAdmin && field(record, "area") !== field(profile, "area")) deny();
  return {
    uid: claims.sub,
    role: isAdmin ? "admin" : "area",
    area: field(record, "area"),
  };
}
