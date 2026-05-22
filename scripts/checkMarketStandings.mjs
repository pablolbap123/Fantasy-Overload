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
    select coalesce(max(number), 0)::int as max_official_matchday,
      coalesce(max(number) + 1, 8)::int as next_matchday,
      count(*)::int as official_matchday_count
    from public.official_matchdays
  `);
  const leagues = await client.query(`
    select
      l.id,
      l.name,
      l.current_matchday::int,
      l.max_members::int,
      count(lm.id)::int as member_count
    from public.leagues l
    left join public.league_members lm on lm.league_id = l.id
    group by l.id
    order by l.created_at desc
  `);
  const market = await client.query(`
    select
      league_id,
      count(*) filter (where market_status = 'market' and owner_user_id is null and listed_by_user_id is null and market_expires_at > now())::int as active_system_market,
      round(extract(epoch from max(market_expires_at - now())) / 3600, 2)::numeric as max_hours_left
    from public.league_players
    group by league_id
    order by active_system_market desc
  `);
  const standings = await client.query(`
    select
      l.name,
      lm.user_id,
      lm.total_points::int,
      lm.last_matchday_points::int,
      lm.joined_matchday::int,
      lm.points_by_matchday,
      lm.created_at
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    order by l.created_at desc, lm.total_points desc
    limit 20
  `);
  const prices = await client.query(`
    select
      name,
      current_price::int,
      base_price::int,
      total_points::int,
      stats_json->'priceHistory' as price_history
    from public.players
    order by total_points desc, current_price desc
    limit 5
  `);

  console.log(JSON.stringify({ official: official.rows[0], leagues: leagues.rows, market: market.rows, standings: standings.rows, prices: prices.rows }, null, 2));
} finally {
  await client.end();
}
