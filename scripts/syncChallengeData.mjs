import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const challengeUrl = "https://challenge.place/c/68486e1155cbb0e036a0559f";
const stageId = "69de85f89e7d357d88be816c";
const stageName = "Temporada 1 GO";
const stageUrl = `${challengeUrl}/stage/${stageId}`;
const transfersUrl = `${challengeUrl}/transfers`;
const staticBaseUrl = "https://static.challengeplace.com";

const canonicalNames = {
  BLSA: "Bolsa de Jugadores",
  LAFC: "LAFC",
  LAG: "LA Galaxy",
  NAP: "Napoli",
  MIA: "Inter de Miami",
  NAS: "Al Nassr",
  BOC: "Boca Juniors",
  RIV: "River Plate",
  SAN: "Santos",
  WOL: "Wolfsburgo",
  FLA: "Flamengo",
  BRU: "Brujas",
};

const teamColors = {
  BLSA: "#64748b",
  MIL: "#ef4444",
  AJA: "#f43f5e",
  NAS: "#facc15",
  ARS: "#dc2626",
  ATH: "#e11d48",
  ATM: "#2563eb",
  FCB: "#7c3aed",
  LEV: "#ef4444",
  BAY: "#dc2626",
  BEN: "#b91c1c",
  BOC: "#fbbf24",
  DOR: "#facc15",
  CHE: "#2563eb",
  FLA: "#ef4444",
  MIA: "#fb7185",
  INT: "#1d4ed8",
  JUV: "#d1d5db",
  LIV: "#dc2626",
  LAFC: "#f59e0b",
  LAG: "#38bdf8",
  MCI: "#38bdf8",
  MUN: "#dc2626",
  NAP: "#0ea5e9",
  LYO: "#2563eb",
  MAR: "#22d3ee",
  POR: "#2563eb",
  PSG: "#1e3a8a",
  RMA: "#f8fafc",
  RIV: "#f1f5f9",
  SAN: "#e5e7eb",
  SEV: "#ef4444",
  TOT: "#f8fafc",
  VAL: "#f97316",
  WOL: "#22c55e",
  ROM: "#f97316",
  FEY: "#ef4444",
  S04: "#2563eb",
  BRU: "#1d4ed8",
};

const positionFallback = ["POR", "DEF", "DEF", "DEF", "MED", "MED", "MED", "DEL", "DEL", "DEL"];
const positions = new Set(["POR", "DEF", "MED", "DEL"]);
const statKeyMap = {
  goal: "goals",
  stillGoal: "goals",
  assist: "assists",
  yellowCard: "yellowCards",
  redCard: "redCards",
  doubleYellowCard: "doubleYellowCards",
  ownGoal: "ownGoals",
  penaltyGoal: "penaltiesScored",
  penaltyMissed: "penaltiesMissed",
  penaltySaved: "penaltiesSaved",
  penaltyProvoked: "penaltiesProvoked",
  penaltyWon: "penaltiesProvoked",
  penaltyReceived: "penaltiesProvoked",
  goalConceded: "goalsConceded",
};
const eventTypeMap = {
  goal: "goal",
  stillGoal: "goal",
  assist: "assist",
  yellowCard: "yellow_card",
  redCard: "red_card",
  doubleYellowCard: "double_yellow_card",
  ownGoal: "own_goal",
  penaltyGoal: "penalty_scored",
  penaltyMissed: "penalty_missed",
  penaltySaved: "penalty_saved",
  penaltyProvoked: "penalty_provoked",
  penaltyWon: "penalty_provoked",
  penaltyReceived: "penalty_provoked",
};
const eventLabels = {
  goal: "Gol",
  stillGoal: "Gol",
  assist: "Asistencia",
  yellowCard: "Tarjeta amarilla",
  redCard: "Tarjeta roja",
  doubleYellowCard: "Doble amarilla",
  ownGoal: "Gol en propia",
  penaltyGoal: "Penalti marcado",
  penaltyMissed: "Penalti fallado",
  penaltySaved: "Penalti parado",
  penaltyProvoked: "Penalti provocado",
  penaltyWon: "Penalti provocado",
  penaltyReceived: "Penalti provocado",
};

const cleanName = (name, acronym) => {
  const canonical = canonicalNames[acronym];
  if (canonical) return canonical;
  return String(name).replaceAll('"', "").replace(/^\[(.*)]$/, "$1").trim();
};

const imageUrl = (path) => {
  if (!path) return "";
  return path.startsWith("http") ? path : `${staticBaseUrl}${path}`;
};

const slug = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const hashNumber = (value) => {
  const hash = createHash("sha256").update(value).digest();
  return hash.readUInt32BE(0);
};

const uuidFrom = (value) => {
  const hex = createHash("md5").update(value).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const derivePosition = (player, lineupPositions, index) => {
  const fromProfile = (player.positions ?? [])
    .map((position) => (typeof position === "string" ? lineupPositions?.[position]?.acronym ?? position : position?.acronym))
    .find((position) => positions.has(position));
  if (fromProfile) return fromProfile;
  const fromLineup = (player.lineupPositions ?? [])
    .map((positionId) => lineupPositions?.[positionId]?.acronym)
    .find((position) => positions.has(position));
  if (fromLineup) return fromLineup;
  if (positions.has(player.acronym)) return player.acronym;
  return positionFallback[(hashNumber(`${player.id}-${index}`) + index) % positionFallback.length];
};

const derivePositions = (player, lineupPositions, index) => {
  const fromProfile = (player.positions ?? [])
    .map((position) => (typeof position === "string" ? lineupPositions?.[position]?.acronym ?? position : position?.acronym))
    .filter((position) => positions.has(position));
  const fromLineup = (player.lineupPositions ?? [])
    .map((positionId) => lineupPositions?.[positionId]?.acronym)
    .filter((position) => positions.has(position));
  const all = [...fromProfile, ...fromLineup, positions.has(player.acronym) ? player.acronym : null, derivePosition(player, lineupPositions, index)]
    .filter(Boolean)
    .filter((position, positionIndex, list) => list.indexOf(position) === positionIndex);
  return all.length > 0 ? all : [derivePosition(player, lineupPositions, index)];
};

const numberStat = (stats, key) => Number(stats?.[key] ?? 0);
const safeTimestamp = (value) => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
};

const makeEmptyStats = () => ({
  appearances: 0,
  goals: 0,
  assists: 0,
  goalsConceded: 0,
  cleanSheets: 0,
  yellowCards: 0,
  redCards: 0,
  doubleYellowCards: 0,
  penaltiesScored: 0,
  penaltiesMissed: 0,
  penaltiesSaved: 0,
  penaltiesProvoked: 0,
  ownGoals: 0,
  mvps: 0,
  overloadPoints: 0,
  minutes: 0,
  keyActions: 0,
});

const makeStats = (stageStats) => {
  const stats = makeEmptyStats();
  // Challenge already includes penalty goals inside the generic "goal" counter.
  // Keep penaltyGoal only as penalty metadata so a 1-goal team cannot create 2 fantasy goals.
  stats.goals = numberStat(stageStats, "goal") + numberStat(stageStats, "stillGoal");
  stats.assists = numberStat(stageStats, "assist");
  stats.goalsConceded = numberStat(stageStats, "goalConceded");
  stats.yellowCards = numberStat(stageStats, "yellowCard");
  stats.redCards = numberStat(stageStats, "redCard");
  stats.doubleYellowCards = numberStat(stageStats, "doubleYellowCard");
  stats.ownGoals = numberStat(stageStats, "ownGoal");
  stats.penaltiesScored = numberStat(stageStats, "penaltyGoal");
  stats.penaltiesMissed = numberStat(stageStats, "penaltyMissed");
  stats.penaltiesSaved = numberStat(stageStats, "penaltySaved");
  stats.penaltiesProvoked = numberStat(stageStats, "penaltyProvoked") + numberStat(stageStats, "penaltyWon") + numberStat(stageStats, "penaltyReceived");
  stats.keyActions = stats.assists + stats.goals + stats.penaltiesProvoked + numberStat(stageStats, "corner");
  return stats;
};

const overloadRatingFor = (stats, position, seedValue = "") => {
  if (typeof stats.overloadRating === "number" && stats.overloadRating > 0) return Math.max(0, Math.min(4, Math.round(stats.overloadRating)));
  const doubleYellowCards = stats.doubleYellowCards ?? Math.min(stats.yellowCards ?? 0, stats.redCards ?? 0);
  const directRedCards = Math.max(0, (stats.redCards ?? 0) - doubleYellowCards);
  const performance =
    (stats.goals ?? 0) * (position === "POR" || position === "DEF" ? 2.4 : position === "MED" ? 2.1 : 1.8) +
    (stats.assists ?? 0) * 1.55 +
    (stats.penaltiesSaved ?? 0) * 2.2 +
    (stats.penaltiesProvoked ?? 0) * 1.3 +
    (stats.cleanSheet ? (position === "POR" || position === "DEF" ? 1.1 : 0.55) : 0) -
    (stats.ownGoals ?? 0) * 2.4 -
    (stats.penaltiesMissed ?? 0) * 1.8 -
    directRedCards * 2.2 -
    doubleYellowCards * 1.1 -
    (stats.yellowCards ?? 0) * 0.45 -
    Math.floor((stats.goalsConceded ?? 0) / 2) * (position === "POR" || position === "DEF" ? 0.75 : 0.35);
  const jitter = (hashNumber(`${seedValue}`) % 100) / 100;
  const score = performance + jitter;
  if (score >= 4.5) return 4;
  if (score >= 2.35) return 3;
  if (score >= 0.65) return 2;
  return 1;
};

const totalPointsFor = (stats, position) => {
  const doubleYellowCards = stats.doubleYellowCards ?? Math.min(stats.yellowCards ?? 0, stats.redCards ?? 0);
  const directRedCards = Math.max(0, (stats.redCards ?? 0) - doubleYellowCards);
  const cleanSheetPoints = stats.cleanSheet ? (position === "POR" ? 4 : position === "DEF" ? 4 : position === "MED" ? 2 : 1) : 0;
  const goalsConcededPoints = Math.floor((stats.goalsConceded ?? 0) / 2) * (position === "POR" || position === "DEF" ? -2 : -1);
  return (
    (stats.goals ?? 0) * (position === "DEL" ? 4 : position === "MED" ? 5 : 6) +
    (stats.assists ?? 0) * 3 +
    cleanSheetPoints +
    goalsConcededPoints -
    (stats.yellowCards ?? 0) -
    doubleYellowCards -
    directRedCards * 3 -
    (stats.ownGoals ?? 0) * 2 -
    (stats.penaltiesMissed ?? 0) * 2 +
    (stats.penaltiesSaved ?? 0) * 5 +
    (stats.penaltiesProvoked ?? 0) * 2 +
    overloadRatingFor(stats, position, `${stats.matchId ?? ""}:${stats.playerId ?? ""}`)
  );
};

const priceFor = (team, position, totalPoints, stats, seed) => {
  const positionBase = position === "DEL" ? 3_400_000 : position === "MED" ? 3_000_000 : position === "DEF" ? 2_650_000 : 2_300_000;
  const teamComponent = Math.max(0, team.strength - 62) * 55_000;
  const pointsComponent = totalPoints >= 0 ? totalPoints * 430_000 : totalPoints * 160_000;
  const productionBonus = stats.goals * 260_000 + stats.assists * 150_000 + stats.penaltiesSaved * 220_000;
  const formSwing = Object.values(stats).reduce((sum, value) => sum + (typeof value === "number" ? value : 0), 0) * 137;
  const noise = (seed % 900_000) + (formSwing % 97_531);
  const value = Math.max(1_000_000, positionBase + teamComponent + pointsComponent + productionBonus + noise);
  return Math.round(value);
};

const roundMarketPrice = (value) => Math.round(value / 50_000) * 50_000;

const marketValueFor = (basePrice, cumulativePoints, matchdayPoints) =>
  roundMarketPrice(Math.max(500_000, Math.min(250_000_000, basePrice + cumulativePoints * 250_000 + matchdayPoints * 150_000)));

const buildPriceHistory = (basePrice, pointsByMatchday) => {
  let cumulativePoints = 0;
  const history = {};
  for (const number of Object.keys(pointsByMatchday).map(Number).filter(Boolean).sort((a, b) => a - b)) {
    const points = Number(pointsByMatchday[number] ?? 0);
    cumulativePoints += points;
    history[number] = marketValueFor(basePrice, cumulativePoints, points);
  }
  return history;
};

const readInitialState = async (url) => {
  let response;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    response = await fetch(url);
    if (response.ok) break;
    if (response.status !== 429 || attempt === 7) {
      throw new Error(`Challenge responded ${response.status} for ${url}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2500 + attempt * 2500));
  }
  const html = await response.text();
  const marker = "window.__INITIAL_STATE__=";
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`Challenge initial state marker not found for ${url}`);
  const jsonStart = start + marker.length;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  return JSON.parse(html.slice(jsonStart, jsonEnd));
};

const mapLimit = async (items, limit, mapper) => {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
};

const matchIdFromSeriesId = (seriesId) => (BigInt(`0x${seriesId}`) + 1n).toString(16).padStart(seriesId.length, "0");

const stageState = await readInitialState(stageUrl);
const transferState = await readInitialState(transfersUrl).catch(() => ({ rooms: {} }));
const stageRoom = Object.values(stageState.rooms)[0];
const transferRoom = Object.values(transferState.rooms ?? {})[0] ?? {};
const mergedCompetitors = new Map();
for (const team of [...Object.values(transferRoom.competitors ?? {}), ...Object.values(stageRoom.competitors ?? {})]) {
  mergedCompetitors.set(team.id, team);
}
const rawTransfers = (transferRoom.transfers ?? stageRoom.latestTransfers ?? [])
  .filter((transfer) => transfer?.playerId && transfer?.fromCompetitorId && transfer?.toCompetitorId)
  .map((transfer) => ({
    ...transfer,
    date: safeTimestamp(transfer.date),
  }))
  .filter((transfer) => transfer.date > 0)
  .sort((a, b) => a.date - b.date || a.playerId.localeCompare(b.playerId));
const latestTransferByPlayerId = new Map();
for (const transfer of rawTransfers) latestTransferByPlayerId.set(transfer.playerId, transfer);

const rawTeams = [...mergedCompetitors.values()].sort((a, b) => {
  if (a.acronym === "BLSA") return -1;
  if (b.acronym === "BLSA") return 1;
  return cleanName(a.name, a.acronym).localeCompare(cleanName(b.name, b.acronym));
});

const teams = rawTeams.map((team) => {
  const name = cleanName(team.name, team.acronym);
  const playerCount = Object.values(stageRoom.players).filter((player) => player.competitorId === team.id).length;
  return {
    id: `team-${slug(team.acronym)}`,
    challengeId: team.id,
    name,
    shortName: team.acronym,
    badgeUrl: imageUrl(team.img),
    color: teamColors[team.acronym] ?? "#38bdf8",
    strength: team.acronym === "BLSA" ? 62 : Math.min(94, 68 + Math.round(playerCount * 0.75) + ((hashNumber(team.id) % 12) - 4)),
    playerCount,
  };
});

const teamByChallengeId = new Map(teams.map((team) => [team.challengeId, team]));
const teamByShortName = new Map(teams.map((team) => [team.shortName, team]));
const mergedPlayers = new Map();
for (const player of Object.values(transferRoom.players ?? {})) {
  const latestTransfer = latestTransferByPlayerId.get(player.id);
  mergedPlayers.set(player.id, { ...player, competitorId: latestTransfer?.toCompetitorId ?? player.competitorId });
}
for (const player of Object.values(stageRoom.players ?? {})) {
  const latestTransfer = latestTransferByPlayerId.get(player.id);
  mergedPlayers.set(player.id, { ...mergedPlayers.get(player.id), ...player, competitorId: latestTransfer?.toCompetitorId ?? player.competitorId });
}
const rawPlayers = [...mergedPlayers.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
const transfersByPlayerId = new Map();
for (const transfer of rawTransfers) {
  const current = transfersByPlayerId.get(transfer.playerId) ?? [];
  current.push(transfer);
  transfersByPlayerId.set(transfer.playerId, current);
}
const competitorIdForPlayerAt = (playerId, matchTimestamp) => {
  const player = mergedPlayers.get(playerId);
  const transfers = transfersByPlayerId.get(playerId) ?? [];
  if (transfers.length === 0) return player?.competitorId;
  let competitorId = transfers[0].fromCompetitorId;
  for (const transfer of transfers) {
    if (transfer.date <= matchTimestamp) competitorId = transfer.toCompetitorId;
    else break;
  }
  return competitorId ?? player?.competitorId;
};
const playerIdsForCompetitorAt = (competitorId, matchTimestamp) =>
  rawPlayers.filter((player) => competitorIdForPlayerAt(player.id, matchTimestamp) === competitorId).map((player) => player.id);
const stageStatsByPlayerId = new Map();
const profilePlayerByChallengeId = new Map();
const lineupPositionsByCompetitorId = new Map();

await mapLimit(teams, 4, async (team) => {
  const teamState = await readInitialState(`${challengeUrl}/competitor/${team.challengeId}`);
  const teamRoom = Object.values(teamState.rooms)[0];
  if (teamRoom?.lineupPositions) lineupPositionsByCompetitorId.set(team.challengeId, teamRoom.lineupPositions);
  for (const player of Object.values(teamRoom?.players ?? {})) {
    profilePlayerByChallengeId.set(player.id, { ...profilePlayerByChallengeId.get(player.id), ...player });
    const stats = player.stageStats?.[stageId];
    if (stats) stageStatsByPlayerId.set(player.id, stats);
  }
});

const playerPositionByChallengeId = new Map();
const playerNameByChallengeId = new Map();
const players = rawPlayers.map((player, index) => {
  const profilePlayer = { ...player, ...profilePlayerByChallengeId.get(player.id) };
  const team = teamByChallengeId.get(player.competitorId) ?? teamByChallengeId.get(profilePlayer.competitorId) ?? teamByShortName.get("BLSA");
  const lineupPositions = lineupPositionsByCompetitorId.get(team.challengeId) ?? stageRoom.lineupPositions;
  const playerPositions = derivePositions(profilePlayer, lineupPositions, index);
  const position = playerPositions[0];
  const seed = hashNumber(player.id);
  const challengeStageStats = stageStatsByPlayerId.get(player.id) ?? {};
  const stats = makeStats(challengeStageStats);
  const totalPoints = totalPointsFor(stats, position);
  const basePrice = priceFor(team, position, 0, makeEmptyStats(), seed);
  const currentPrice = priceFor(team, position, totalPoints, stats, seed);
  playerPositionByChallengeId.set(player.id, position);
  playerNameByChallengeId.set(player.id, player.name);

  return {
    id: `player-${player.id}`,
    challengeId: player.id,
    name: player.name,
    imageUrl: imageUrl(player.img),
    teamId: team.id,
    teamName: team.name,
    position,
    positions: playerPositions,
    basePrice,
    currentPrice,
    fantasyValue: Number((totalPoints / Math.max(Number(player.stats?.matchesPlayed ?? 0), 1)).toFixed(1)),
    totalPoints,
    pointsByMatchday: {},
    status: "disponible",
    stats,
    challengeStageStats,
  };
});

const playerByChallengeId = new Map(players.map((player) => [player.challengeId, player]));
const officialMatchdays = [];
const pointBucketsByPlayer = new Map();
const matchStatsByPlayer = new Map();

const buildPlayerMatchStats = (matchRoom, matchId, homeScore, awayScore, matchTimestamp) => {
  const buckets = new Map();
  const touch = (playerId, competitorId) => {
    const key = `${matchId}-${playerId}`;
    if (!buckets.has(key)) {
      const resolvedCompetitorId = competitorId ?? competitorIdForPlayerAt(playerId, matchTimestamp);
      const teamIsHome = resolvedCompetitorId === matchRoom.homeCompetitorId;
      const teamGoalsConceded = teamIsHome ? awayScore : homeScore;
      buckets.set(key, {
        matchId,
        playerId: `player-${playerId}`,
        minutes: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        doubleYellowCards: 0,
        ownGoals: 0,
        penaltiesScored: 0,
        penaltiesMissed: 0,
        penaltiesSaved: 0,
        penaltiesProvoked: 0,
        goalsConceded: teamGoalsConceded,
        cleanSheet: teamGoalsConceded === 0,
        overloadRating: 0,
        mvp: false,
        teamWon: teamIsHome ? homeScore > awayScore : awayScore > homeScore,
        teamLost: teamIsHome ? homeScore < awayScore : awayScore < homeScore,
        highlighted: false,
        errorLedToGoal: false,
        fantasyPoints: 0,
      });
    }
    return buckets.get(key);
  };

  for (const competitorId of [matchRoom.homeCompetitorId, matchRoom.awayCompetitorId]) {
    for (const playerId of playerIdsForCompetitorAt(competitorId, matchTimestamp)) {
      touch(playerId, competitorId);
    }
  }

  for (const event of Object.values(matchRoom.events ?? {})) {
    for (const [statKey, statValue] of Object.entries(event.stats ?? {})) {
      const mappedKey = statKeyMap[statKey];
      if (!mappedKey) continue;
      for (const [playerId, value] of Object.entries(statValue.players ?? {})) {
        const bucket = touch(playerId, statValue.competitorId ?? event.competitorId);
        const numericValue = Number(value ?? 0);
        if (statKey === "goalConceded") {
          bucket[mappedKey] = Math.max(bucket[mappedKey] ?? 0, numericValue);
        } else {
          bucket[mappedKey] += numericValue;
        }
      }
    }
  }

  for (const event of Object.values(matchRoom.events ?? {})) {
    if (event.eventSettingsId !== "penaltyGoal") continue;
    const hasGenericGoal = Boolean(event.stats?.goal);
    if (hasGenericGoal) continue;
    for (const [playerId, value] of Object.entries(event.stats?.penaltyGoal?.players ?? {})) {
      const bucket = touch(playerId, event.stats?.penaltyGoal?.competitorId ?? event.competitorId);
      bucket.goals += Number(value ?? 0);
    }
  }

  for (const bucket of buckets.values()) {
    const challengePlayerId = bucket.playerId.replace(/^player-/, "");
    const position = playerPositionByChallengeId.get(challengePlayerId) ?? "MED";
    bucket.doubleYellowCards = bucket.doubleYellowCards || Math.min(bucket.yellowCards, bucket.redCards);
    bucket.overloadRating = overloadRatingFor(bucket, position, `${bucket.matchId}:${bucket.playerId}`);
    bucket.fantasyPoints = totalPointsFor(bucket, position);
  }
  return [...buckets.values()];
};

const buildMatchEvents = (matchRoom, matchId) =>
  Object.values(matchRoom.events ?? {})
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((event) => eventTypeMap[event.eventSettingsId])
    .map((event) => {
      const playerId = event.playerIds?.[0];
      const playerName = playerNameByChallengeId.get(playerId) ?? "Jugador";
      return {
        id: `event-${event.id}`,
        matchId,
        minute: Number(event.order ?? 0),
        type: eventTypeMap[event.eventSettingsId],
        teamId: teamByChallengeId.get(event.competitorId)?.id ?? "team-blsa",
        playerId: playerId ? `player-${playerId}` : undefined,
        description: `${eventLabels[event.eventSettingsId]}: ${playerName}`,
      };
    });

const rounds = Object.values(stageRoom.rounds).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
const roundNumberFor = (round, fallback = 1) => Number(String(round.name).replace(/\D+/g, "")) || Number(round.order ?? fallback);
const maxRoundNumber = Math.max(1, ...rounds.map((round, index) => roundNumberFor(round, index + 1)));
const fallbackReferenceTime = safeTimestamp(stageRoom.lastUpdate) || safeTimestamp(stageRoom.timestamp) || Date.now();
await mapLimit(rounds, 1, async (round) => {
  const matchStates = await mapLimit(round.seriesIds ?? [], 3, async (seriesId) => {
    const matchChallengeId = matchIdFromSeriesId(seriesId);
    return readInitialState(`${challengeUrl}/match/${matchChallengeId}`);
  });

  const matches = matchStates
    .map((matchState) => Object.values(matchState.rooms)[0])
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((matchRoom) => {
      const matchChallengeId = matchIdFromSeriesId(matchRoom.seriesId);
      const matchId = `challenge-match-${matchChallengeId}`;
      const home = teamByChallengeId.get(matchRoom.homeCompetitorId) ?? teamByShortName.get("BLSA");
      const away = teamByChallengeId.get(matchRoom.awayCompetitorId) ?? teamByShortName.get("BLSA");
      const homeScore = Number(matchRoom.homeScore ?? 0);
      const awayScore = Number(matchRoom.awayScore ?? 0);
      const matchdayNumber = Number(String(matchRoom.roundName ?? round.name).replace(/\D+/g, "")) || Number(round.order ?? 1);
      const timestamp = safeTimestamp(matchRoom.timestamp);
      const stableFallbackTime =
        fallbackReferenceTime -
        Math.max(0, maxRoundNumber - matchdayNumber + 1) * 86_400_000 +
        Number(matchRoom.order ?? 0) * 60_000;
      const matchTimestamp = timestamp || stableFallbackTime;
      const playedAt = new Date(matchTimestamp).toISOString();
      const playerStats = buildPlayerMatchStats(matchRoom, matchId, homeScore, awayScore, matchTimestamp);
      for (const stat of playerStats) {
        const current = pointBucketsByPlayer.get(stat.playerId) ?? {};
        current[matchdayNumber] = (current[matchdayNumber] ?? 0) + Number(stat.fantasyPoints ?? 0);
        pointBucketsByPlayer.set(stat.playerId, current);

        const aggregate = matchStatsByPlayer.get(stat.playerId) ?? makeEmptyStats();
        aggregate.appearances += 1;
        aggregate.goals += stat.goals ?? 0;
        aggregate.assists += stat.assists ?? 0;
        aggregate.goalsConceded += stat.goalsConceded ?? 0;
        aggregate.cleanSheets += stat.cleanSheet ? 1 : 0;
        aggregate.yellowCards += stat.yellowCards ?? 0;
        aggregate.redCards += stat.redCards ?? 0;
        aggregate.doubleYellowCards += stat.doubleYellowCards ?? 0;
        aggregate.ownGoals += stat.ownGoals ?? 0;
        aggregate.penaltiesScored += stat.penaltiesScored ?? 0;
        aggregate.penaltiesMissed += stat.penaltiesMissed ?? 0;
        aggregate.penaltiesSaved += stat.penaltiesSaved ?? 0;
        aggregate.penaltiesProvoked += stat.penaltiesProvoked ?? 0;
        aggregate.overloadPoints += stat.overloadRating ?? 0;
        aggregate.keyActions += (stat.goals ?? 0) + (stat.assists ?? 0) + (stat.penaltiesProvoked ?? 0) + (stat.penaltiesSaved ?? 0);
        matchStatsByPlayer.set(stat.playerId, aggregate);
      }

      return {
        id: matchId,
        challengeId: matchChallengeId,
        matchdayId: `matchday-${matchdayNumber}`,
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeTeamName: home.name,
        awayTeamName: away.name,
        homeTeamShortName: home.shortName,
        awayTeamShortName: away.shortName,
        homeScore,
        awayScore,
        status: "finalizada",
        playedAt,
        events: buildMatchEvents(matchRoom, matchId),
        playerStats,
      };
    });

  const number = roundNumberFor(round);
  const startsAt = matches[0]?.playedAt ?? new Date().toISOString();
  officialMatchdays.push({
    id: `matchday-${number}`,
    leagueId: "league-demo",
    number,
    status: "finalizada",
    startsAt,
    endsAt: matches.at(-1)?.playedAt ?? startsAt,
    matches,
  });
});

officialMatchdays.sort((a, b) => a.number - b.number);
for (const player of players) {
  player.pointsByMatchday = pointBucketsByPlayer.get(player.id) ?? {};
  const matchStats = matchStatsByPlayer.get(player.id);
  if (matchStats) {
    player.stats = { ...player.stats, ...matchStats };
  }
  player.totalPoints = Object.values(player.pointsByMatchday).reduce((sum, points) => sum + Number(points ?? 0), 0);
  player.fantasyValue = Number((player.totalPoints / Math.max(Object.keys(player.pointsByMatchday).length, 1)).toFixed(1));
  player.priceHistory = buildPriceHistory(player.basePrice, player.pointsByMatchday);
  player.currentPrice = player.priceHistory[Object.keys(player.priceHistory).map(Number).sort((a, b) => a - b).at(-1)] ?? player.basePrice;
}

const header = `// Generated by scripts/syncChallengeData.mjs from ${stageUrl}\n// Source snapshot: Challenge Place public initial state, ${players.length} players.\n// Do not edit this file by hand.\n`;

const ts = `${header}import type { Player, Team } from "../types";\n\nexport const challengeMeta = ${JSON.stringify(
  {
    sourceUrl: challengeUrl,
    stageUrl,
    stageName,
    stageId,
    fetchedAt: new Date().toISOString(),
    playerCount: players.length,
    teamCount: teams.length,
    matchdayCount: officialMatchdays.length,
    matchCount: officialMatchdays.reduce((sum, matchday) => sum + matchday.matches.length, 0),
    currentMatchday: Math.max(1, ...officialMatchdays.map((matchday) => matchday.number)) + 1,
    playersWithStageStats: stageStatsByPlayerId.size,
    transferCount: rawTransfers.length,
    transferHistorySource: transfersUrl,
  },
  null,
  2,
)} as const;\n\nexport const challengeTeams: Team[] = ${JSON.stringify(
  teams.map(({ playerCount: _playerCount, challengeId: _challengeId, ...team }) => team),
  null,
  2,
)};\n\nexport const challengePlayers: Player[] = ${JSON.stringify(
  players.map(({ challengeId: _challengeId, challengeStageStats: _challengeStageStats, ...player }) => player),
  null,
  2,
)};\n`;

const fixturesTs = `${header}import type { Matchday } from "../types";\n\nexport const challengeMatchdays: Matchday[] = ${JSON.stringify(
  officialMatchdays.map((matchday) => ({
    ...matchday,
    matches: matchday.matches.map(({ challengeId: _challengeId, homeTeamShortName: _homeShort, awayTeamShortName: _awayShort, ...match }) => match),
  })),
  null,
  2,
)};\n`;

const teamSqlRows = teams.map((team) => ({
  id: uuidFrom(`team-${team.challengeId}`),
  name: team.name,
  short_name: team.shortName,
  color: team.color,
  badge_url: team.badgeUrl,
  strength: team.strength,
}));

const playerSqlRows = players.map((player) => ({
  id: uuidFrom(`player-${player.challengeId}`),
  name: player.name,
  image_url: player.imageUrl,
  team_short_name: teams.find((team) => team.id === player.teamId)?.shortName ?? "BLSA",
  position: player.position,
  positions: player.positions ?? [player.position],
  base_price: player.basePrice,
  current_price: player.currentPrice,
  fantasy_value: player.fantasyValue,
  status: player.status,
  total_points: player.totalPoints,
  points_by_matchday: player.pointsByMatchday,
  stats_json: { ...player.stats, priceHistory: player.priceHistory },
  challenge_stage_stats: player.challengeStageStats,
}));

const officialMatchdaySqlRows = officialMatchdays.map((matchday) => ({
  number: matchday.number,
  name: `Jornada ${matchday.number}`,
  status: matchday.status,
  starts_at: matchday.startsAt,
  ends_at: matchday.endsAt,
}));

const officialMatchSqlRows = officialMatchdays.flatMap((matchday) =>
  matchday.matches.map((match) => ({
    challenge_match_id: match.challengeId,
    matchday_number: matchday.number,
    home_team_short_name: match.homeTeamShortName,
    away_team_short_name: match.awayTeamShortName,
    home_score: match.homeScore,
    away_score: match.awayScore,
    status: match.status,
    played_at: match.playedAt,
    events_json: match.events.map((event) => ({
      ...event,
      player_id: event.playerId ? uuidFrom(event.playerId) : null,
      team_short_name: teams.find((team) => team.id === event.teamId)?.shortName ?? "BLSA",
    })),
    player_stats_json: match.playerStats.map((stat) => ({
      ...stat,
      player_uuid: uuidFrom(stat.playerId),
      yellow_cards: stat.yellowCards ?? 0,
      red_cards: stat.redCards ?? 0,
      double_yellow_cards: stat.doubleYellowCards ?? 0,
      own_goals: stat.ownGoals ?? 0,
      penalties_scored: stat.penaltiesScored ?? 0,
      penalties_missed: stat.penaltiesMissed ?? 0,
      penalties_saved: stat.penaltiesSaved ?? 0,
      penalties_provoked: stat.penaltiesProvoked ?? 0,
      goals_conceded: stat.goalsConceded ?? 0,
      clean_sheet: stat.cleanSheet ?? false,
      overload_rating: stat.overloadRating ?? 0,
      team_won: stat.teamWon ?? false,
      team_lost: stat.teamLost ?? false,
      error_led_to_goal: stat.errorLedToGoal ?? false,
      fantasy_points: stat.fantasyPoints ?? 0,
    })),
  })),
);

const matchdayStarts = officialMatchdays
  .map((matchday) => ({ number: matchday.number, timestamp: safeTimestamp(new Date(matchday.startsAt).getTime()) }))
  .filter((item) => item.timestamp > 0)
  .sort((a, b) => a.timestamp - b.timestamp);
const effectiveMatchdayForTransfer = (timestamp) =>
  matchdayStarts.find((matchday) => matchday.timestamp >= timestamp)?.number ?? maxRoundNumber + 1;

const transferSqlRows = rawTransfers
  .filter((transfer) => playerByChallengeId.has(transfer.playerId))
  .map((transfer) => ({
    challenge_transfer_key: `${transfer.playerId}:${transfer.fromCompetitorId}:${transfer.toCompetitorId}:${transfer.date}`,
    player_id: uuidFrom(`player-${transfer.playerId}`),
    from_team_short_name: teamByChallengeId.get(transfer.fromCompetitorId)?.shortName ?? "BLSA",
    to_team_short_name: teamByChallengeId.get(transfer.toCompetitorId)?.shortName ?? "BLSA",
    transfer_date: new Date(transfer.date).toISOString(),
    effective_matchday: effectiveMatchdayForTransfer(transfer.date),
    raw_json: transfer,
  }));

const historySqlRows = [];
for (const player of rawPlayers) {
  const transfers = transfersByPlayerId.get(player.id) ?? [];
  if (transfers.length === 0) {
    historySqlRows.push({
      id: uuidFrom(`history-${player.id}-${player.competitorId ?? "unknown"}-current`),
      player_id: uuidFrom(`player-${player.id}`),
      team_short_name: teamByChallengeId.get(player.competitorId)?.shortName ?? "BLSA",
      from_date: null,
      to_date: null,
      from_matchday: null,
      to_matchday: null,
    });
    continue;
  }

  let activeTeamId = transfers[0].fromCompetitorId;
  let activeFromDate = null;
  let activeFromMatchday = null;
  transfers.forEach((transfer, index) => {
    historySqlRows.push({
      id: uuidFrom(`history-${player.id}-${activeTeamId}-${activeFromDate ?? "origin"}-${transfer.date}`),
      player_id: uuidFrom(`player-${player.id}`),
      team_short_name: teamByChallengeId.get(activeTeamId)?.shortName ?? "BLSA",
      from_date: activeFromDate ? new Date(activeFromDate).toISOString() : null,
      to_date: new Date(transfer.date).toISOString(),
      from_matchday: activeFromMatchday,
      to_matchday: Math.max(1, effectiveMatchdayForTransfer(transfer.date) - 1),
    });
    activeTeamId = transfer.toCompetitorId;
    activeFromDate = transfer.date;
    activeFromMatchday = effectiveMatchdayForTransfer(transfer.date);
    if (index === transfers.length - 1) {
      historySqlRows.push({
        id: uuidFrom(`history-${player.id}-${activeTeamId}-${activeFromDate}-current`),
        player_id: uuidFrom(`player-${player.id}`),
        team_short_name: teamByChallengeId.get(activeTeamId)?.shortName ?? "BLSA",
        from_date: new Date(activeFromDate).toISOString(),
        to_date: null,
        from_matchday: activeFromMatchday,
        to_matchday: null,
      });
    }
  });
}

let seedSql = `-- Generated by scripts/syncChallengeData.mjs from ${stageUrl}\n-- Public Challenge snapshot: ${players.length} players, ${teams.length} competitors, ${officialMatchSqlRows.length} played matches.\n\ninsert into public.teams (id, name, short_name, color, badge_url, strength)\nselect * from jsonb_to_recordset($teams$${JSON.stringify(
  teamSqlRows,
)}$teams$::jsonb) as t(id uuid, name text, short_name text, color text, badge_url text, strength integer)\non conflict (short_name) do update\nset name = excluded.name,\n    color = excluded.color,\n    badge_url = excluded.badge_url,\n    strength = excluded.strength;\n\ninsert into public.players (\n  id, name, image_url, team_id, position, positions, base_price, current_price, fantasy_value, status, total_points, points_by_matchday, stats_json\n)\nselect\n  p.id,\n  p.name,\n  p.image_url,\n  t.id,\n  p.position,\n  case when jsonb_typeof(p.positions) = 'array' and jsonb_array_length(p.positions) > 0 then array(select jsonb_array_elements_text(p.positions)) else array[p.position] end,\n  p.base_price,\n  p.current_price,\n  p.fantasy_value,\n  p.status,\n  p.total_points,\n  p.points_by_matchday,\n  p.stats_json || jsonb_build_object('positions', case when jsonb_typeof(p.positions) = 'array' and jsonb_array_length(p.positions) > 0 then p.positions else jsonb_build_array(p.position) end, 'challengeStageStats', p.challenge_stage_stats, 'sourceStage', '${stageName}')\nfrom jsonb_to_recordset($players$${JSON.stringify(
  playerSqlRows,
)}$players$::jsonb) as p(\n  id uuid,\n  name text,\n  image_url text,\n  team_short_name text,\n  position text,\n  positions jsonb,\n  base_price numeric,\n  current_price numeric,\n  fantasy_value numeric,\n  status text,\n  total_points integer,\n  points_by_matchday jsonb,\n  stats_json jsonb,\n  challenge_stage_stats jsonb\n)\njoin public.teams t on t.short_name = p.team_short_name\non conflict (id) do update\nset team_id = excluded.team_id,\n    name = excluded.name,\n    position = excluded.position,\n    positions = excluded.positions,\n    image_url = excluded.image_url,\n    base_price = excluded.base_price,\n    current_price = excluded.current_price,\n    fantasy_value = excluded.fantasy_value,\n    status = excluded.status,\n    total_points = excluded.total_points,\n    points_by_matchday = excluded.points_by_matchday,\n    stats_json = excluded.stats_json;\n\ninsert into public.official_matchdays (number, name, status, starts_at, ends_at)\nselect * from jsonb_to_recordset($official_matchdays$${JSON.stringify(
  officialMatchdaySqlRows,
)}$official_matchdays$::jsonb) as md(number integer, name text, status text, starts_at timestamptz, ends_at timestamptz)\non conflict (number) do update\nset name = excluded.name,\n    status = excluded.status,\n    starts_at = excluded.starts_at,\n    ends_at = excluded.ends_at;\n\ninsert into public.official_matches (\n  challenge_match_id, matchday_number, home_team_short_name, away_team_short_name, home_score, away_score, status, played_at, events_json, player_stats_json\n)\nselect * from jsonb_to_recordset($official_matches$${JSON.stringify(
  officialMatchSqlRows,
)}$official_matches$::jsonb) as m(\n  challenge_match_id text,\n  matchday_number integer,\n  home_team_short_name text,\n  away_team_short_name text,\n  home_score integer,\n  away_score integer,\n  status text,\n  played_at timestamptz,\n  events_json jsonb,\n  player_stats_json jsonb\n)\non conflict (challenge_match_id) do update\nset matchday_number = excluded.matchday_number,\n    home_team_short_name = excluded.home_team_short_name,\n    away_team_short_name = excluded.away_team_short_name,\n    home_score = excluded.home_score,\n    away_score = excluded.away_score,\n    status = excluded.status,\n    played_at = excluded.played_at,\n    events_json = excluded.events_json,\n    player_stats_json = excluded.player_stats_json;\n`;

const transferSeedSql = `\n\ninsert into public.challenge_transfers (
  challenge_transfer_key, player_id, from_team_id, to_team_id, transfer_date, effective_matchday, raw_json
)
select
  tr.challenge_transfer_key,
  tr.player_id,
  ft.id,
  tt.id,
  tr.transfer_date,
  tr.effective_matchday,
  tr.raw_json
from jsonb_to_recordset($challenge_transfers$${JSON.stringify(
  transferSqlRows,
)}$challenge_transfers$::jsonb) as tr(
  challenge_transfer_key text,
  player_id uuid,
  from_team_short_name text,
  to_team_short_name text,
  transfer_date timestamptz,
  effective_matchday integer,
  raw_json jsonb
)
left join public.teams ft on ft.short_name = tr.from_team_short_name
left join public.teams tt on tt.short_name = tr.to_team_short_name
on conflict (challenge_transfer_key) do update
set player_id = excluded.player_id,
    from_team_id = excluded.from_team_id,
    to_team_id = excluded.to_team_id,
    transfer_date = excluded.transfer_date,
    effective_matchday = excluded.effective_matchday,
    raw_json = excluded.raw_json;

insert into public.player_team_history (
  id, player_id, team_id, from_date, to_date, from_matchday, to_matchday, source
)
select
  h.id,
  h.player_id,
  t.id,
  h.from_date,
  h.to_date,
  h.from_matchday,
  h.to_matchday,
  'challenge'
from jsonb_to_recordset($player_team_history$${JSON.stringify(
  historySqlRows,
)}$player_team_history$::jsonb) as h(
  id uuid,
  player_id uuid,
  team_short_name text,
  from_date timestamptz,
  to_date timestamptz,
  from_matchday integer,
  to_matchday integer
)
join public.teams t on t.short_name = h.team_short_name
on conflict (id) do update
set player_id = excluded.player_id,
    team_id = excluded.team_id,
    from_date = excluded.from_date,
    to_date = excluded.to_date,
    from_matchday = excluded.from_matchday,
    to_matchday = excluded.to_matchday,
    source = excluded.source;\n`;

const cleanupSeedSql = `\n\nwith snapshot_players as (
  select id
  from jsonb_to_recordset($snapshot_players$${JSON.stringify(playerSqlRows.map((player) => ({ id: player.id })))}$snapshot_players$::jsonb) as p(id uuid)
)
delete from public.league_players lp
where not exists (select 1 from snapshot_players sp where sp.id = lp.player_id)
  and lp.owner_user_id is null;

with snapshot_players as (
  select id
  from jsonb_to_recordset($snapshot_players$${JSON.stringify(playerSqlRows.map((player) => ({ id: player.id })))}$snapshot_players$::jsonb) as p(id uuid)
)
delete from public.players p
where not exists (select 1 from snapshot_players sp where sp.id = p.id)
  and not exists (select 1 from public.squads s where s.player_id = p.id);\n`;

seedSql = seedSql
  .replace("on conflict (short_name) do update\nset name = excluded.name,", "on conflict (id) do update\nset name = excluded.name,\n    short_name = excluded.short_name,");

const tsPath = resolve("src/data/challengeData.ts");
const fixturesPath = resolve("src/data/challengeFixtures.ts");
const seedPath = resolve("supabase/seed.sql");
await mkdir(dirname(tsPath), { recursive: true });
await mkdir(dirname(seedPath), { recursive: true });
await writeFile(tsPath, ts, "utf8");
await writeFile(fixturesPath, fixturesTs, "utf8");
await writeFile(seedPath, seedSql + transferSeedSql + cleanupSeedSql, "utf8");

const byPosition = players.reduce((acc, player) => {
  acc[player.position] = (acc[player.position] ?? 0) + 1;
  return acc;
}, {});

console.log(`Synced ${players.length} players, ${teams.length} teams and ${officialMatchSqlRows.length} matches from Challenge Place.`);
console.log(byPosition);
