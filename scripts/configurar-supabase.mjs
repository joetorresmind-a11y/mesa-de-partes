import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { writeFile } from "node:fs/promises";
const rl = createInterface({ input: stdin, output: stdout });
try {
  const input = (
    await rl.question("Pega Project URL de Supabase (https://...supabase.co): ")
  ).trim();
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error("Usa Project URL, sin claves ni rutas adicionales.");
  const endpoint = url.origin + "/functions/v1/adjuntos";
  await writeFile(
    new URL("../docs/supabase-config.js", import.meta.url),
    `// Dirección pública; no contiene claves secretas.\nexport const SUPABASE_FUNCTION_URL = ${JSON.stringify(endpoint)};\n`,
  );
  console.log(
    "Guardado docs/supabase-config.js. Súbelo a GitHub con la nueva versión.",
  );
  console.log(
    "Referencia de proyecto para el despliegue:",
    url.hostname.split(".")[0],
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
