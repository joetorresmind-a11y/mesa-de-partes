import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUPABASE_FUNCTION_URL } from "../docs/supabase-config.js";

export function deploymentPlan(endpoint, npmPath = process.env.npm_execpath) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw Error("Primero ejecuta npm.cmd run configurar:supabase.");
  }
  const match = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !match ||
    url.pathname !== "/functions/v1/adjuntos" ||
    url.search ||
    url.hash
  ) {
    throw Error(
      "La dirección de Supabase no es válida. Ejecuta npm.cmd run configurar:supabase.",
    );
  }
  const cli = npmPath && join(dirname(npmPath), "npx-cli.js");
  if (!cli || !existsSync(cli))
    throw Error(
      "Ejecuta este asistente con npm.cmd run publicar:supabase desde la raíz del proyecto.",
    );
  return {
    command: process.execPath,
    args: [
      cli,
      "--yes",
      "supabase@3.4.0",
      "functions",
      "deploy",
      "adjuntos",
      "--remote=" + match[1],
      "--no-verify-jwt",
      "--use-api",
    ],
    options: {
      stdio: "inherit",
      shell: false,
      cwd: fileURLToPath(new URL("../", import.meta.url)),
    },
    project: match[1],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const plan = deploymentPlan(SUPABASE_FUNCTION_URL);
    console.log(
      "Publicando la función adjuntos en el proyecto " + plan.project + ".",
    );
    const child = spawn(plan.command, plan.args, plan.options);
    child.on("error", (error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
      if (code === 0)
        console.log(
          "Función publicada. Continúa con la actualización de GitHub y la prueba de registro y respuesta descrita en README.md.",
        );
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
