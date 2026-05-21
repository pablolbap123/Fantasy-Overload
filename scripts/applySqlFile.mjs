import { readFileSync } from "node:fs";
import { Client } from "pg";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/applySqlFile.mjs <file.sql>");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is required");
  process.exit(1);
}

const sql = readFileSync(filePath, "utf8");
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(sql);
const check = await client.query(
  "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'unavailable_until_matchday'",
);
await client.end();

console.log(JSON.stringify({ applied: true, unavailableUntilMatchday: check.rows[0]?.column_name ?? null }));
