import { authorizeStaff } from "./firebase-access.mjs";
const MAX = 10 * 1024 * 1024;
const TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
async function bytes(request) {
  if (Number(request.headers.get("Content-Length")) > MAX)
    fail("El archivo supera los 10 MB.", 413);
  if (!request.body) fail("El archivo está vacío.");
  const reader = request.body.getReader(),
    chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX) {
      await reader.cancel();
      fail("El archivo supera los 10 MB.", 413);
    }
    chunks.push(value);
  }
  if (!size) fail("El archivo está vacío.");
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
function validSignature(b, type) {
  if (type === "application/pdf")
    return new TextDecoder().decode(b.slice(0, 5)) === "%PDF-";
  if (type === "image/jpeg")
    return b[0] === 255 && b[1] === 216 && b[2] === 255;
  return (
    b.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v)
  );
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const cors = {
      Vary: "Origin",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    };
    if (!allowed.includes(origin))
      return Response.json(
        { error: "Origen no autorizado." },
        { status: 403, headers: cors },
      );
    cors["Access-Control-Allow-Origin"] = origin;
    cors["Access-Control-Allow-Methods"] = "GET, PUT, OPTIONS";
    cors["Access-Control-Allow-Headers"] =
      "Content-Type, X-File-Key, X-File-Name, X-Response-Id, Authorization";
    cors["Access-Control-Expose-Headers"] = "Content-Disposition";
    try {
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: cors });
      const path = new URL(request.url).pathname
        .replace(/^\/functions\/v1\/adjuntos/, "")
        .replace(/^\/adjuntos/, "");
      if (path === "/health" && request.method === "GET") {
        const ready = !!env.DOCUMENTS && (await env.DOCUMENTS.health());
        return Response.json(
          { ok: ready, service: "mesa-supabase", version: 8 },
          { status: ready ? 200 : 503, headers: cors },
        );
      }
      if (path !== "/file") fail("Recurso no encontrado.", 404);
      const token = request.headers.get("X-File-Key") || "";
      if (!/^[a-f0-9]{32}$/.test(token))
        fail("Clave de archivo inválida.", 403);
      if (!env.DOCUMENTS) fail("El almacenamiento no está configurado.", 503);
      const responseId = request.headers.get("X-Response-Id") || "";
      if (responseId && !/^[a-f0-9]{32}$/.test(responseId))
        fail("Identificador de respuesta inválido.", 400);
      if (
        request.headers.has("Authorization") ||
        (responseId && request.method === "PUT")
      )
        await authorizeStaff(request, token, env.FIREBASE_FETCH || fetch);
      const key = responseId
        ? "responses/" + token + "/" + responseId
        : "attachments/" + token;
      if (request.method === "GET") {
        const object = await env.DOCUMENTS.get(key);
        if (!object) fail("Archivo no encontrado.", 404);
        const filename = object.customMetadata?.filename || "documento";
        return new Response(object.body, {
          headers: {
            ...cors,
            "Content-Type":
              object.httpMetadata?.contentType || "application/octet-stream",
            "Content-Disposition":
              "attachment; filename=\"documento\"; filename*=UTF-8''" +
              encodeURIComponent(filename),
          },
        });
      }
      if (request.method !== "PUT") fail("Operación no permitida.", 405);
      const type = request.headers.get("Content-Type")?.split(";")[0];
      if (!TYPES.has(type)) fail("Solo se permite PDF, JPG o PNG.", 415);
      let filename;
      try {
        filename = decodeURIComponent(
          request.headers.get("X-File-Name") || "documento",
        );
      } catch {
        fail("Nombre inválido.");
      }
      filename = filename.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 255);
      const content = await bytes(request);
      if (!validSignature(content, type))
        fail("El contenido no corresponde a un PDF, JPG o PNG.", 415);
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", content)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      const saved = await env.DOCUMENTS.put(key, content, {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: { contentType: type },
        customMetadata: { filename, sha256: hash },
      });
      if (!saved) {
        const previous = await env.DOCUMENTS.head(key);
        if (
          previous?.customMetadata?.sha256 !== hash ||
          previous?.httpMetadata?.contentType !== type
        )
          fail(
            "Ya hay un adjunto distinto para este intento. Abre un nuevo formulario.",
            409,
          );
      }
      return Response.json(
        { ok: true, size: content.length },
        { status: saved ? 201 : 200, headers: cors },
      );
    } catch (error) {
      return Response.json(
        {
          error: error.status
            ? error.message
            : "No se pudo acceder al almacenamiento. Inténtalo nuevamente.",
        },
        { status: error.status || 503, headers: cors },
      );
    }
  },
};
