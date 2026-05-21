import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const result = await client.query(`
    select
      proname,
      position('p.status in (''lesionado'', ''sancionado'')' in prosrc) > 0 as checks_status,
      position('p_matchday_number <= p.unavailable_until_matchday' in prosrc) > 0 as checks_until_by_number,
      position('v_matchday_number <= p.unavailable_until_matchday' in prosrc) > 0 as checks_until_by_id
    from pg_proc
    where proname in ('submit_lineup_by_number', 'submit_lineup')
    order by proname
  `);

  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await client.end();
}
