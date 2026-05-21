import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const [players, teams, matches, transfers, history, syncStatus] = await Promise.all([
  client.query("select count(*)::int as count from public.players"),
  client.query("select count(*)::int as count from public.teams"),
  client.query("select count(*)::int as count from public.official_matches"),
  client.query("select count(*)::int as count from public.challenge_transfers"),
  client.query("select count(*)::int as count from public.player_team_history"),
  client.query("select status, message, snapshot_hash from public.challenge_sync_status where id = 'overload-series'"),
]);

await client.end();
console.log(
  JSON.stringify({
    players: players.rows[0].count,
    teams: teams.rows[0].count,
    officialMatches: matches.rows[0].count,
    challengeTransfers: transfers.rows[0].count,
    playerTeamHistory: history.rows[0].count,
    syncStatus: syncStatus.rows[0] ?? null,
  }),
);
