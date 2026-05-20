import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const intervalMs = Number(process.env.CHALLENGE_SYNC_INTERVAL_MS ?? 10_000);
const databaseUrl = process.env.SUPABASE_DB_URL;
const seedPath = new URL("../supabase/seed.sql", import.meta.url);
const challengeStageUrl = "https://challenge.place/c/68486e1155cbb0e036a0559f/stage/69de85f89e7d357d88be816c";

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const hashFile = async (fileUrl) => {
  const content = await readFile(fileUrl);
  return createHash("sha256").update(content).digest("hex");
};

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
    await client.query(sql, params);
    return true;
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

const applyLatestSnapshot = async () => {
  const seedSql = await readFile(seedPath, "utf8");
  await applySql(`
    ${seedSql}
    select set_config('request.jwt.claim.role', 'service_role', false);
    select public.sync_all_leagues_from_official();
    select public.resolve_all_market_auctions();
  `);
};

let lastHash = "";
console.log(`[challenge-watch] Vigilando Challenge cada ${intervalMs}ms.`);

while (true) {
  try {
    await updateSyncStatus("checking", "Comprobando cambios oficiales de Challenge Place...");
    const beforeHash = await hashFile(seedPath).catch(() => "");
    await runNode(["scripts/syncChallengeData.mjs"]);
    const nextHash = await hashFile(seedPath);
    const changed = nextHash !== beforeHash || nextHash !== lastHash;
    if (changed) {
      await applyLatestSnapshot();
      lastHash = nextHash;
      await updateSyncStatus("changed", "Cambios de Challenge aplicados en web y movil.", { snapshotHash: nextHash, changed: true });
      console.log(`[challenge-watch] Cambios aplicados en Supabase: ${new Date().toISOString()}`);
    } else {
      await updateSyncStatus("ok", "Sin cambios oficiales detectados.", { snapshotHash: nextHash });
      console.log(`[challenge-watch] Sin cambios: ${new Date().toISOString()}`);
    }
  } catch (error) {
    await updateSyncStatus("error", `Error al sincronizar Challenge: ${shortError(error)}`);
    console.error("[challenge-watch] Error:", error);
  }
  await sleep(intervalMs);
}
