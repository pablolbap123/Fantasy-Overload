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

const pollMs = Number(process.env.CHALLENGE_REQUEST_POLL_MS ?? 15_000);
const databaseUrl = process.env.SUPABASE_DB_URL;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

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

const applySql = async (sql, params = []) => {
  if (!databaseUrl) {
    console.log("[challenge-watch] SUPABASE_DB_URL no definido; solo se actualizaron archivos locales.");
    return false;
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

const shortError = (error) => {
  if (error instanceof Error) return error.message.slice(0, 240);
  return String(error).slice(0, 240);
};

const updateSyncStatus = async (status, message, options = {}) => {
  const now = new Date().toISOString();
  try {
    await applySql(
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
        values ('overload-series', $1, $2, $3, $4, $5, $6, $5)
        on conflict (id) do update
        set source_url = excluded.source_url,
            status = excluded.status,
            message = excluded.message,
            snapshot_hash = coalesce(excluded.snapshot_hash, public.challenge_sync_status.snapshot_hash),
            last_checked_at = excluded.last_checked_at,
            last_changed_at = coalesce(excluded.last_changed_at, public.challenge_sync_status.last_changed_at),
            updated_at = excluded.updated_at
      `,
      [
        challengeStageUrl,
        status,
        message,
        options.snapshotHash ?? null,
        now,
        options.changed ? now : null,
      ],
    );
  } catch (error) {
    console.warn("[challenge-watch] No se pudo actualizar challenge_sync_status:", shortError(error));
  }
};

const takePendingSyncRequests = async () => {
  if (!databaseUrl) return [];
  try {
    const result = await applySql(`
      with next_requests as (
        select id
        from public.challenge_sync_requests
        where status = 'pending'
        order by created_at
        limit 25
      )
      update public.challenge_sync_requests request
      set status = 'processing',
          message = 'Sincronizacion en curso.',
          processed_at = now()
      from next_requests
      where request.id = next_requests.id
      returning request.id
    `);
    return result?.rows?.map((row) => row.id) ?? [];
  } catch (error) {
    console.warn("[challenge-watch] No se pudieron leer solicitudes manuales:", shortError(error));
    return [];
  }
};

const finishSyncRequests = async (requestIds, status, message) => {
  if (!requestIds.length) return;
  try {
    await applySql(
      `
        update public.challenge_sync_requests
        set status = $2,
            message = $3,
            processed_at = now()
        where id = any($1::uuid[])
      `,
      [requestIds, status, message],
    );
  } catch (error) {
    console.warn("[challenge-watch] No se pudieron cerrar solicitudes manuales:", shortError(error));
  }
};

const cleanupSyncRequests = async () => {
  try {
    await applySql(`
      delete from public.challenge_sync_requests
      where status in ('completed', 'failed')
        and (
          created_at < now() - interval '7 days'
          or id in (
            select id
            from public.challenge_sync_requests
            where status in ('completed', 'failed')
            order by created_at desc
            offset 100
          )
        )
    `);
  } catch (error) {
    console.warn("[challenge-watch] No se pudieron limpiar solicitudes antiguas:", shortError(error));
  }
};

const applyLatestSnapshot = async () => {
  const seedSql = await readFile(seedPath, "utf8");
  await applySql(`
    ${seedSql}
    select set_config('request.jwt.claim.role', 'service_role', false);
    select public.sync_all_leagues_from_official();
    select public.resolve_all_market_auctions();
  `);
};

console.log(`[challenge-watch] Modo manual: solo sincroniza Challenge cuando llega una solicitud. Revisa solicitudes cada ${pollMs}ms.`);

while (true) {
  let requestIds = [];
  try {
    requestIds = await takePendingSyncRequests();
    if (!requestIds.length) {
      await sleep(pollMs);
      continue;
    }
    await updateSyncStatus(
      "checking",
      "Actualizacion manual solicitada. Comprobando Challenge Place...",
    );
    await runNode(["scripts/syncChallengeData.mjs"]);
    await applyLatestSnapshot();
    await updateSyncStatus("changed", "Actualizacion manual de Challenge aplicada en web y movil.", { changed: true });
    await finishSyncRequests(requestIds, "completed", "Actualizacion manual de Challenge aplicada.");
    await cleanupSyncRequests();
    console.log(`[challenge-watch] Actualizacion manual aplicada en Supabase: ${new Date().toISOString()}`);
  } catch (error) {
    await updateSyncStatus("error", `Error al sincronizar Challenge: ${shortError(error)}`);
    await finishSyncRequests(requestIds, "failed", shortError(error));
    console.error("[challenge-watch] Error:", error);
  }
  await sleep(pollMs);
}
