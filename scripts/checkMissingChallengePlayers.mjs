import { readFileSync } from "node:fs";
import { Client } from "pg";

const seed = readFileSync("supabase/seed.sql", "utf8");
const match = seed.match(/\$players\$(.*?)\$players\$/s);
const snapshotPlayers = match ? JSON.parse(match[1]).map((player) => player.id) : [];

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const result = await client.query(
  `
    select p.id, p.name, count(s.id)::int as squad_count, count(lp.id)::int as league_player_count
    from public.players p
    left join public.squads s on s.player_id = p.id
    left join public.league_players lp on lp.player_id = p.id
    where not (p.id = any($1::uuid[]))
    group by p.id, p.name
    order by p.name
  `,
  [snapshotPlayers],
);
await client.end();
console.log(JSON.stringify(result.rows));
