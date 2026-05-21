import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const official = await client.query(`
    select min(number)::int as min_number, max(number)::int as max_number, count(*)::int as count
    from public.official_matchdays
  `);
  const leagues = await client.query(`
    select l.id, l.name, l.current_matchday::int, min(md.number)::int as min_matchday, max(md.number)::int as max_matchday, count(md.id)::int as matchday_count
    from public.leagues l
    left join public.matchdays md on md.league_id = l.id
    group by l.id, l.name, l.current_matchday
    order by l.created_at desc
    limit 20
  `);
  const officialNumbers = await client.query(`
    select number::int, status
    from public.official_matchdays
    order by number
  `);

  console.log(JSON.stringify({ official: official.rows[0], officialNumbers: officialNumbers.rows, leagues: leagues.rows }, null, 2));
} finally {
  await client.end();
}
