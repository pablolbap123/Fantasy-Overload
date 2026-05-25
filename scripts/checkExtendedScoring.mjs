import { readFile } from "node:fs/promises";
import { Client } from "pg";

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

if (!process.env.SUPABASE_DB_URL) throw new Error("Falta SUPABASE_DB_URL.");

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const columns = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_match_stats'
      and column_name in (
        'key_passes',
        'overload_score',
        'saves',
        'shots_on_target',
        'successful_dribbles',
        'box_entries',
        'balls_lost',
        'balls_recovered',
        'clearances'
      )
    order by column_name
  `);
  const rules = await client.query("select public.default_scoring_rules() as rules");
  const payload = rules.rows[0].rules;
  console.log(
    JSON.stringify({
      columns: columns.rows.map((row) => row.column_name),
      playedOver60: payload.playedOver60,
      keyPass: payload.keyPass,
      savesEveryTwo: payload.savesEveryTwo,
      overload: payload.overloadRating,
    }),
  );
} finally {
  await client.end();
}
