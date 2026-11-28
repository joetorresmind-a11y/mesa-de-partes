import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deploymentPlan } from "../scripts/publicar-supabase.mjs";

test("El despliegue usa el proyecto configurado, CLI fijada y ejecución sin shell", () => {
  const root = mkdtempSync(join(tmpdir(), "mesa-deploy-"));
  try {
    writeFileSync(join(root, "npx-cli.js"), "");
    const plan = deploymentPlan(
      "https://sbkpcuuyfsmrdqxamtte.supabase.co/functions/v1/adjuntos",
      join(root, "npm-cli.js"),
    );
    assert.equal(plan.project, "sbkpcuuyfsmrdqxamtte");
    assert.equal(plan.options.shell, false);
    assert.equal(plan.command, process.execPath);
    assert(plan.args.includes("--remote=sbkpcuuyfsmrdqxamtte"));
    assert(plan.args.includes("--use-api"));
    assert(plan.args.includes("supabase@3.4.0"));
    assert(!plan.args.includes("--prune"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("El asistente rechaza direcciones ajenas o rutas de API incorrectas antes de ejecutar", () => {
  for (const url of [
    "http://sbkpcuuyfsmrdqxamtte.supabase.co/functions/v1/adjuntos",
    "https://example.org/functions/v1/adjuntos",
    "https://sbkpcuuyfsmrdqxamtte.supabase.co/rest/v1/",
    "https://sbkpcuuyfsmrdqxamtte.supabase.co/functions/v1/adjuntos?cmd=bad",
  ])
    assert.throws(() => deploymentPlan(url));
});
