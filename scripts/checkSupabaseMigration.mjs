import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const functions = await client.query(
  "select proname from pg_proc where proname in ('admin_update_player_availability','admin_set_current_matchday','submit_lineup_by_number','recalculate_league_points') order by proname",
);
const bucket = await client.query("select id, public from storage.buckets where id = 'avatars'");

await client.end();
console.log(JSON.stringify({ functions: functions.rows.map((row) => row.proname), bucket: bucket.rows[0] ?? null }));
