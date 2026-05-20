import { defaultScoringRules } from "../data/scoringRules";
import type { Match, MatchEvent, Player, PlayerMatchStats, ScoringRules, Team } from "../types";
import { calculatePlayerFantasyPoints } from "./calculatePoints";

const randomId = () => Math.random().toString(36).slice(2, 10);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const weightedGoalScorer = (players: Player[]) => {
  const pool = players.flatMap((player) => {
    const weight = player.position === "DEL" ? 8 : player.position === "MED" ? 5 : player.position === "DEF" ? 2 : 1;
    return Array.from({ length: weight }, () => player);
  });
  return pick(pool);
};

const weightedAssistant = (players: Player[], scorerId: string) => {
  const candidates = players.filter((player) => player.id !== scorerId && player.position !== "POR");
  const pool = candidates.flatMap((player) => {
    const weight = player.position === "MED" ? 7 : player.position === "DEL" ? 4 : 2;
    return Array.from({ length: weight }, () => player);
  });
  return pool.length > 0 ? pick(pool) : undefined;
};

const scoreFor = (team: Team, opponent: Team) => {
  const strengthGap = (team.strength - opponent.strength) / 30;
  const base = Math.random() * 2.7 + strengthGap;
  return clamp(Math.round(base), 0, 5);
};

const createBlankStats = (
  matchId: string,
  player: Player,
  teamWon: boolean,
  teamLost: boolean,
  goalsConceded: number,
): PlayerMatchStats => {
  const starterBias = player.position === "POR" ? 1 : Math.random();
  const minutes = starterBias > 0.22 ? 60 + Math.floor(Math.random() * 31) : Math.floor(Math.random() * 45);
  const cleanSheet = minutes > 0 && goalsConceded === 0;

  return {
    matchId,
    playerId: player.id,
    minutes,
    goals: 0,
    assists: 0,
    yellowCards: Math.random() < 0.12 ? 1 : 0,
    redCards: Math.random() < 0.018 ? 1 : 0,
    doubleYellowCards: 0,
    ownGoals: Math.random() < 0.008 ? 1 : 0,
    penaltiesScored: 0,
    penaltiesMissed: 0,
    penaltiesSaved: player.position === "POR" && Math.random() < 0.025 ? 1 : 0,
    penaltiesProvoked: 0,
    goalsConceded,
    cleanSheet,
    mvp: false,
    teamWon,
    teamLost,
    highlighted: Math.random() < 0.08,
    errorLedToGoal: Math.random() < 0.025,
  };
};

export const simulateMatch = (
  homeTeam: Team,
  awayTeam: Team,
  allPlayers: Player[],
  scoringRules: ScoringRules = defaultScoringRules,
  matchdayId = "simulated-matchday",
): Match => {
  const matchId = `match-${randomId()}`;
  const homeScore = scoreFor(homeTeam, awayTeam);
  const awayScore = scoreFor(awayTeam, homeTeam);
  const homePlayers = allPlayers.filter((player) => player.teamId === homeTeam.id).slice(0, 18);
  const awayPlayers = allPlayers.filter((player) => player.teamId === awayTeam.id).slice(0, 18);
  const events: MatchEvent[] = [];

  const playerStats = [
    ...homePlayers.map((player) => createBlankStats(matchId, player, homeScore > awayScore, homeScore < awayScore, awayScore)),
    ...awayPlayers.map((player) => createBlankStats(matchId, player, awayScore > homeScore, awayScore < homeScore, homeScore)),
  ];

  // La simulación favorece a delanteros para goles y a mediocentros para asistencias sin bloquear sorpresas.
  const addGoal = (teamPlayers: Player[], teamId: string, minuteOffset: number) => {
    const scorer = weightedGoalScorer(teamPlayers);
    const assistant = Math.random() < 0.72 ? weightedAssistant(teamPlayers, scorer.id) : undefined;
    const stat = playerStats.find((item) => item.playerId === scorer.id);
    if (stat) {
      stat.goals += 1;
      if (Math.random() < 0.12) stat.penaltiesScored += 1;
      if (stat.penaltiesScored > 0 && Math.random() < 0.45) stat.penaltiesProvoked = (stat.penaltiesProvoked ?? 0) + 1;
    }
    if (assistant) {
      const assistStat = playerStats.find((item) => item.playerId === assistant.id);
      if (assistStat) assistStat.assists += 1;
    }
    events.push({
      id: `event-${randomId()}`,
      matchId,
      minute: clamp(minuteOffset + Math.floor(Math.random() * 12), 1, 90),
      type: "goal",
      teamId,
      playerId: scorer.id,
      relatedPlayerId: assistant?.id,
      description: `${scorer.name}${assistant ? `, asistencia de ${assistant.name}` : ""}`,
    });
  };

  Array.from({ length: homeScore }).forEach((_, index) => addGoal(homePlayers, homeTeam.id, 12 + index * 16));
  Array.from({ length: awayScore }).forEach((_, index) => addGoal(awayPlayers, awayTeam.id, 18 + index * 14));

  const mvpCandidates = playerStats
    .filter((stat) => stat.goals + stat.assists > 0 || stat.cleanSheet)
    .sort((a, b) => b.goals + b.assists - (a.goals + a.assists));
  const mvp = mvpCandidates[0] ?? pick(playerStats);
  if (mvp) {
    mvp.mvp = true;
    const player = allPlayers.find((item) => item.id === mvp.playerId);
    events.push({
      id: `event-${randomId()}`,
      matchId,
      minute: 90,
      type: "mvp",
      teamId: player?.teamId ?? homeTeam.id,
      playerId: mvp.playerId,
      description: `${player?.name ?? "Jugador"} fue MVP`,
    });
  }

  const enrichedStats = playerStats.map((stat) => {
    const player = allPlayers.find((item) => item.id === stat.playerId);
    return {
      ...stat,
      fantasyPoints: player ? calculatePlayerFantasyPoints(stat, scoringRules, player.position) : 0,
    };
  });

  return {
    id: matchId,
    matchdayId,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    homeScore,
    awayScore,
    status: "finalizada",
    playedAt: new Date().toISOString(),
    events,
    playerStats: enrichedStats,
  };
};
