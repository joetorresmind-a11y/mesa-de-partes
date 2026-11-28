// Adaptador privado. El cliente con privilegios existe solo en la función.
export function createStorage(client) {
  const bucket = client.storage.from("mesa-partes-adjuntos");
  const missing = (e) =>
    String(e?.statusCode) === "404" ||
    e?.code === "NoSuchKey" ||
    e?.message === "Object not found";
  return {
    async health() {
      const { data, error } = await client.storage.getBucket(
        "mesa-partes-adjuntos",
      );
      return !error && !!data && data.public === false;
    },
    async put(key, content, options) {
      const { data, error } = await bucket.upload(key, content, {
        contentType: options.httpMetadata.contentType,
        upsert: false,
        cacheControl: "0",
      });
      if (!error) return data;
      if (
        String(error.statusCode) === "409" ||
        error.code === "Duplicate" ||
        error.message === "The resource already exists"
      )
        return null;
      throw error;
    },
    async get(key) {
      const { data, error } = await bucket.download(key);
      if (error) {
        if (missing(error)) return null;
        throw error;
      }
      return {
        body: data.stream(),
        httpMetadata: { contentType: data.type },
        customMetadata: { filename: "documento" },
      };
    },
    async head(key) {
      const { data, error } = await bucket.download(key);
      if (error) {
        if (missing(error)) return null;
        throw error;
      }
      const sha256 = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await data.arrayBuffer()),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      return {
        httpMetadata: { contentType: data.type },
        customMetadata: { sha256 },
      };
    },
  };
}
