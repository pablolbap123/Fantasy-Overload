import { readFile } from "node:fs/promises";

const envText = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const [key, ...value] = line.split("=");
      return [key, value.join("=").replace(/^["']|["']$/g, "")];
    }),
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in .env.local");
  process.exit(1);
}

const response = await fetch(`${supabaseUrl}/rest/v1/challenge_sync_requests`, {
  method: "POST",
  headers: {
    apikey: anonKey,
    authorization: `Bearer ${anonKey}`,
    "content-type": "application/json",
    prefer: "return=minimal",
  },
  body: JSON.stringify({
    requested_by: null,
    status: "pending",
    message: "Solicitud manual de prueba anon.",
  }),
});

if (!response.ok) {
  console.error(await response.text());
  process.exit(1);
}

console.log(JSON.stringify({ inserted: true, status: response.status }));
