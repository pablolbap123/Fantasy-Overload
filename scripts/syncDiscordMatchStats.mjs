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

const databaseUrl = process.env.SUPABASE_DB_URL;
const discordToken = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const leagueId = process.env.DISCORD_LEAGUE_ID || null;
const importLimit = Math.max(1, Math.min(100, Number(process.env.DISCORD_IMPORT_LIMIT ?? 50)));

if (!databaseUrl) throw new Error("Falta SUPABASE_DB_URL en el entorno del worker.");
if (!discordToken) throw new Error("Falta DISCORD_BOT_TOKEN. Crea un bot de Discord y anade su token solo al servidor.");
if (!channelId) throw new Error("Falta DISCORD_CHANNEL_ID. Usa el id del canal donde se suben los partidos.");

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const extractPayloads = (content) => {
  const blocks = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1]);
  const candidates = blocks.length > 0 ? blocks : [content];
  return candidates
    .map((candidate) => {
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};

const fetchMessages = async () => {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${importLimit}`, {
    headers: { Authorization: `Bot ${discordToken}` },
  });
  if (!response.ok) throw new Error(`Discord respondio ${response.status}: ${await response.text()}`);
  return response.json();
};

const findMatch = async (client, payload) => {
  const matchday = Number(payload.matchday ?? payload.jornada ?? payload.round);
  if (!Number.isFinite(matchday)) throw new Error("El JSON de Discord necesita matchday/jornada.");
  const { rows } = await client.query(
    `
      select
        m.id,
        m.home_team_id,
        m.away_team_id,
        md.league_id,
        md.number,
        ht.name as home_name,
        ht.short_name as home_short_name,
        at.name as away_name,
        at.short_name as away_short_name
      from public.matches m
      join public.matchdays md on md.id = m.matchday_id
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      where md.number = $1 and ($2::uuid is null or md.league_id = $2::uuid)
    `,
    [matchday, leagueId],
  );

  const home = normalize(payload.homeTeam ?? payload.home ?? payload.local);
  const away = normalize(payload.awayTeam ?? payload.away ?? payload.visitante);
  const match = rows.find(
    (row) =>
      [row.home_name, row.home_short_name].map(normalize).includes(home) &&
      [row.away_name, row.away_short_name].map(normalize).includes(away),
  );
  if (!match) throw new Error(`No se encontro partido J${matchday}: ${payload.homeTeam ?? payload.home} - ${payload.awayTeam ?? payload.away}.`);
  return match;
};

const loadPlayersForMatch = async (client, match) => {
  const { rows } = await client.query(
    `
      select p.id, p.name, p.position, t.name as team_name, t.short_name as team_short_name
      from public.players p
      join public.teams t on t.id = p.team_id
      where p.team_id in ($1::uuid, $2::uuid)
    `,
    [match.home_team_id, match.away_team_id],
  );
  return rows;
};

const resolvePlayer = (players, raw) => {
  const name = normalize(raw.name ?? raw.player ?? raw.jugador);
  const team = normalize(raw.team ?? raw.equipo ?? "");
  return players.find((player) => {
    const sameName = normalize(player.name) === name;
    const sameTeam = !team || [player.team_name, player.team_short_name].map(normalize).includes(team);
    return sameName && sameTeam;
  });
};

const statPayloadFor = (player, raw, match, homeScore, awayScore) => {
  const teamIsHome = player.team_id === match.home_team_id;
  const goalsConceded = Number(raw.goalsConceded ?? raw.goals_conceded ?? raw.golesRecibidos ?? (teamIsHome ? awayScore : homeScore) ?? 0);
  return {
    playerId: player.id,
    minutes: Number(raw.minutes ?? raw.minutos ?? 0),
    goals: Number(raw.goals ?? raw.goles ?? 0),
    assists: Number(raw.assists ?? raw.asistencias ?? 0),
    keyPasses: Number(raw.keyPasses ?? raw.asistenciasSinGol ?? raw.chancesCreated ?? 0),
    yellowCards: Number(raw.yellowCards ?? raw.amarillas ?? 0),
    redCards: Number(raw.redCards ?? raw.rojas ?? 0),
    doubleYellowCards: Number(raw.doubleYellowCards ?? raw.dobleAmarilla ?? 0),
    ownGoals: Number(raw.ownGoals ?? raw.golesPropia ?? 0),
    penaltiesScored: Number(raw.penaltiesScored ?? raw.penaltisMarcados ?? 0),
    penaltiesMissed: Number(raw.penaltiesMissed ?? raw.penaltisFallados ?? 0),
    penaltiesSaved: Number(raw.penaltiesSaved ?? raw.penaltisParados ?? 0),
    penaltiesProvoked: Number(raw.penaltiesProvoked ?? raw.penaltisProvocados ?? 0),
    goalsConceded,
    cleanSheet: Boolean(raw.cleanSheet ?? raw.porteriaCero ?? goalsConceded === 0),
    overloadScore: Number(raw.overloadScore ?? raw.notaOverload ?? raw.nota ?? 0),
    saves: Number(raw.saves ?? raw.paradas ?? 0),
    shotsOnTarget: Number(raw.shotsOnTarget ?? raw.rematesPuerta ?? 0),
    successfulDribbles: Number(raw.successfulDribbles ?? raw.regatesLogrados ?? 0),
    boxEntries: Number(raw.boxEntries ?? raw.llegadasArea ?? 0),
    ballsLost: Number(raw.ballsLost ?? raw.balonesPerdidos ?? 0),
    ballsRecovered: Number(raw.ballsRecovered ?? raw.balonesRecuperados ?? 0),
    clearances: Number(raw.clearances ?? raw.despejes ?? 0),
  };
};

const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const messages = await fetchMessages();
  const payloads = messages.flatMap((message) => extractPayloads(message.content)).reverse();
  let imported = 0;

  for (const payload of payloads) {
    const playersPayload = payload.players ?? payload.jugadores ?? payload.stats;
    if (!Array.isArray(playersPayload)) continue;

    const match = await findMatch(client, payload);
    const players = await loadPlayersForMatch(client, match);
    const homeScore = Number(payload.homeScore ?? payload.home_score ?? payload.localGoals ?? payload.golesLocal ?? 0);
    const awayScore = Number(payload.awayScore ?? payload.away_score ?? payload.awayGoals ?? payload.golesVisitante ?? 0);
    const stats = playersPayload
      .map((raw) => {
        const player = resolvePlayer(players, raw);
        if (!player) {
          console.warn(`[discord-sync] Jugador no encontrado: ${raw.name ?? raw.player ?? raw.jugador}`);
          return null;
        }
        return statPayloadFor(player, raw, match, homeScore, awayScore);
      })
      .filter(Boolean);

    await client.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    await client.query("select public.update_match_result($1::uuid, $2::integer, $3::integer, $4::jsonb)", [
      match.id,
      homeScore,
      awayScore,
      JSON.stringify(stats),
    ]);
    imported += 1;
    console.log(`[discord-sync] J${match.number} ${match.home_short_name}-${match.away_short_name}: ${stats.length} jugadores importados.`);
  }

  console.log(`[discord-sync] Importados ${imported} partidos desde Discord.`);
} finally {
  await client.end();
}
