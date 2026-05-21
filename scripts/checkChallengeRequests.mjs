import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const status = await client.query(`
    select status, message, last_checked_at, last_changed_at, updated_at
    from public.challenge_sync_status
    where id = 'overload-series'
  `);
  const requests = await client.query(`
    select status, count(*)::int as count, min(created_at) as oldest, max(created_at) as newest
    from public.challenge_sync_requests
    group by status
    order by status
  `);

  console.log(JSON.stringify({ status: status.rows[0] ?? null, requests: requests.rows }, null, 2));
} finally {
  await client.end();
}
