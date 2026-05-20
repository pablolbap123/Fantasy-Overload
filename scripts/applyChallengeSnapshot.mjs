import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const seedPath = new URL("../supabase/seed.sql", import.meta.url);
const challengeStageUrl = "https://challenge.place/c/68486e1155cbb0e036a0559f/stage/69de85f89e7d357d88be816c";

const loadEnvFile = async (fileName) => {
  const fileUrl = new URL(`../${fileName}`, import.meta.url);
  const content = await readFile(fileUrl, "utf8").catch(() => "");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!key || process.env[key]) continue;
    process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
  }
};

await loadEnvFile(".env");
await loadEnvFile(".env.local");
await loadEnvFile(".env.server.local");

const databaseUrl = process.env.SUPABASE_DB_URL;

const runNode = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: new URL("..", import.meta.url),
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`node ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });

const query = async (sql, params = []) => {
  if (!databaseUrl) {
    throw new Error("SUPABASE_DB_URL no esta definido. Configuralo en el entorno del worker o en .env.server.local.");
  }
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
};

await query(
  `
    insert into public.challenge_sync_status (id, source_url, status, message, last_checked_at, updated_at)
    values ('overload-series', $1, 'checking', 'Forzando sincronizacion con Challenge Place...', now(), now())
    on conflict (id) do update
    set source_url = excluded.source_url,
        status = excluded.status,
        message = excluded.message,
        last_checked_at = excluded.last_checked_at,
        updated_at = excluded.updated_at
  `,
  [challengeStageUrl],
);

await runNode(["scripts/syncChallengeData.mjs"]);
const seedSql = await readFile(seedPath, "utf8");
const snapshotHash = createHash("sha256").update(seedSql).digest("hex");

await query(`
  ${seedSql}
  select set_config('request.jwt.claim.role', 'service_role', false);
  select public.sync_all_leagues_from_official();
  select public.resolve_all_market_auctions();
`);

await query(
  `
    insert into public.challenge_sync_status (
      id,
      source_url,
      status,
      message,
      snapshot_hash,
      last_checked_at,
      last_changed_at,
      updated_at
    )
    values ('overload-series', $1, 'changed', 'Snapshot oficial de Challenge aplicado en web y movil.', $2, now(), now(), now())
    on conflict (id) do update
    set source_url = excluded.source_url,
        status = excluded.status,
        message = excluded.message,
        snapshot_hash = excluded.snapshot_hash,
        last_checked_at = excluded.last_checked_at,
        last_changed_at = excluded.last_changed_at,
        updated_at = excluded.updated_at
  `,
  [challengeStageUrl, snapshotHash],
);

console.log(`[challenge-apply] Snapshot aplicado en Supabase (${snapshotHash.slice(0, 12)}).`);
