import { createClient } from "npm:@supabase/supabase-js@2";
import handler from "./handler.mjs";
import { createStorage } from "./storage.mjs";
const url = Deno.env.get("SUPABASE_URL");
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const key =
  secretKeys.default ||
  Object.values(secretKeys)[0] ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const client =
  url && key
    ? createClient(url, String(key), {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
Deno.serve((request) =>
  handler.fetch(request, {
    ALLOWED_ORIGINS:
      Deno.env.get("ALLOWED_ORIGINS") ||
      "https://joetorresmind-a11y.github.io,http://localhost:8787,http://127.0.0.1:8787",
    DOCUMENTS: client ? createStorage(client) : null,
  }),
);
