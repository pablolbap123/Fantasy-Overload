import type { Player, PlayerMatchStats, PlayerPosition, ScoringRules } from "../types";
import { isUnavailableForMatchday } from "./playerAvailability";

export const formationShape: Record<string, Record<PlayerPosition, number>> = {
  "4-4-2": { POR: 1, DEF: 4, MED: 4, DEL: 2 },
  "4-3-3": { POR: 1, DEF: 4, MED: 3, DEL: 3 },
  "3-5-2": { POR: 1, DEF: 3, MED: 5, DEL: 2 },
  "3-4-3": { POR: 1, DEF: 3, MED: 4, DEL: 3 },
  "5-3-2": { POR: 1, DEF: 5, MED: 3, DEL: 2 },
  "4-5-1": { POR: 1, DEF: 4, MED: 5, DEL: 1 },
};

export const positionOrder: PlayerPosition[] = ["POR", "DEF", "MED", "DEL"];

const isPlayerPosition = (value: unknown): value is PlayerPosition =>
  typeof value === "string" && positionOrder.includes(value as PlayerPosition);

export const normalizePlayerPosition = (value: unknown, fallback: PlayerPosition = "MED"): PlayerPosition => {
  if (Array.isArray(value)) return normalizePlayerPosition(value[0], fallback);
  return isPlayerPosition(value) ? value : fallback;
};

export const normalizePlayerPositions = (value: unknown, fallback: PlayerPosition = "MED"): PlayerPosition[] => {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const unique = raw
    .map((position) => normalizePlayerPosition(position, fallback))
    .filter((position, index, list) => list.indexOf(position) === index);
  return unique.length > 0 ? unique : [fallback];
};

export const playerPositions = (player: Player) => {
  const fallback = normalizePlayerPosition(player.position);
  const raw = [fallback, ...normalizePlayerPositions(player.positions, fallback)];
  const unique = raw.filter((position, index, list) => list.indexOf(position) === index);
  return unique.length > 0 ? unique : [fallback];
};

export const assignLineupPositions = (
  players: Player[],
  starterIds: string[],
  formation: keyof typeof formationShape,
): Record<string, PlayerPosition> | null => {
  const shape = formationShape[formation];
  if (!shape || starterIds.length !== 11 || new Set(starterIds).size !== starterIds.length) return null;

  const starters = starterIds.map((playerId) => players.find((player) => player.id === playerId));
  if (starters.some((player) => !player)) return null;

  const remaining = { ...shape };
  const assignment: Record<string, PlayerPosition> = {};
  const ordered = (starters as Player[])
    .map((player, slot) => ({
      player,
      slot,
      positions: playerPositions(player).filter((position) => remaining[position] > 0),
    }))
    .sort((a, b) => a.positions.length - b.positions.length || a.slot - b.slot);

  const choose = (index: number): boolean => {
    if (index >= ordered.length) return true;

    const { player, positions } = ordered[index];
    const choices = [
      player.position,
      ...positions,
      ...positionOrder,
    ].filter((position, choiceIndex, list) => positions.includes(position) && list.indexOf(position) === choiceIndex);

    for (const position of choices) {
      if (remaining[position] <= 0) continue;
      remaining[position] -= 1;
      assignment[player.id] = position;
      if (choose(index + 1)) return true;
      remaining[position] += 1;
      delete assignment[player.id];
    }

    return false;
  };

  return choose(0) ? assignment : null;
};

export interface PlayerPointBreakdownItem {
  key: string;
  label: string;
  quantity: number | string;
  points: number;
}

const stableHash = (value: string) =>
  value.split("").reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 2166136261);

const concededRuleFor = (rules: ScoringRules, position: PlayerPosition) => {
  const rule = rules.goalsConcededEveryTwo;
  if (typeof rule === "number") return position === "POR" || position === "DEF" ? rule : 0;
  return rule[position] ?? 0;
};

const playedPointsFor = (rules: ScoringRules, minutes: number) => {
  if (minutes <= 0) return 0;
  return minutes > 60 ? (rules.playedOver60 ?? rules.sixtyMinutes ?? 2) : (rules.playedUnder60 ?? rules.played ?? 1);
};

const perBlockPoints = (quantity: number | undefined, every: number, points = 0) => Math.floor(Math.max(0, quantity ?? 0) / every) * points;

const hasTrackedMatchAction = (playerMatchStats: PlayerMatchStats) =>
  playerMatchStats.minutes > 0 ||
  [
    playerMatchStats.goals,
    playerMatchStats.assists,
    playerMatchStats.keyPasses ?? 0,
    playerMatchStats.goalsConceded,
    playerMatchStats.yellowCards,
    playerMatchStats.redCards,
    playerMatchStats.doubleYellowCards ?? 0,
    playerMatchStats.ownGoals,
    playerMatchStats.penaltiesScored,
    playerMatchStats.penaltiesMissed,
    playerMatchStats.penaltiesSaved,
    playerMatchStats.penaltiesProvoked ?? 0,
    playerMatchStats.saves ?? 0,
    playerMatchStats.shotsOnTarget ?? 0,
    playerMatchStats.successfulDribbles ?? 0,
    playerMatchStats.boxEntries ?? 0,
    playerMatchStats.ballsLost ?? 0,
    playerMatchStats.ballsRecovered ?? 0,
    playerMatchStats.clearances ?? 0,
  ].some((value) => Number(value ?? 0) !== 0) ||
  Boolean(playerMatchStats.mvp || playerMatchStats.highlighted || playerMatchStats.errorLedToGoal) ||
  Number(playerMatchStats.overloadScore ?? 0) > 0 ||
  Number(playerMatchStats.overloadRating ?? 0) > 0;

export const overloadRatingFromScore = (score?: number) => {
  if (typeof score !== "number" || !Number.isFinite(score)) return undefined;
  if (score >= 9) return 4;
  if (score >= 7) return 3;
  if (score >= 5) return 2;
  if (score >= 2.5) return 1;
  return 0;
};

export const getOverloadRating = (playerMatchStats: PlayerMatchStats, position: PlayerPosition) => {
  const ratingFromScore = overloadRatingFromScore(playerMatchStats.overloadScore);
  if (ratingFromScore !== undefined) return ratingFromScore;

  if (typeof playerMatchStats.overloadRating === "number") {
    return Math.max(0, Math.min(4, Math.round(playerMatchStats.overloadRating)));
  }
  if (!hasTrackedMatchAction(playerMatchStats)) return 0;

  const doubleYellowCards = playerMatchStats.doubleYellowCards ?? Math.min(playerMatchStats.yellowCards, playerMatchStats.redCards);
  const directRedCards = Math.max(0, playerMatchStats.redCards - doubleYellowCards);
  const performance =
    playerMatchStats.goals * (position === "POR" || position === "DEF" ? 2.4 : position === "MED" ? 2.1 : 1.8) +
    playerMatchStats.assists * 1.55 +
    (playerMatchStats.keyPasses ?? 0) * 0.35 +
    playerMatchStats.penaltiesSaved * 2.2 +
    (playerMatchStats.penaltiesProvoked ?? 0) * 1.3 +
    (playerMatchStats.cleanSheet && playerMatchStats.minutes > 60 ? (position === "POR" || position === "DEF" ? 1.1 : 0.55) : 0) +
    (position === "POR" ? perBlockPoints(playerMatchStats.saves, 2, 0.35) : 0) +
    perBlockPoints(playerMatchStats.shotsOnTarget, 2, 0.28) +
    perBlockPoints(playerMatchStats.successfulDribbles, 2, 0.25) +
    perBlockPoints(playerMatchStats.boxEntries, 2, 0.2) +
    perBlockPoints(playerMatchStats.ballsRecovered, 5, 0.4) +
    perBlockPoints(playerMatchStats.clearances, 5, 0.3) -
    perBlockPoints(playerMatchStats.ballsLost, 10, 0.3) -
    playerMatchStats.ownGoals * 2.4 -
    playerMatchStats.penaltiesMissed * 1.8 -
    directRedCards * 2.2 -
    doubleYellowCards * 1.1 -
    playerMatchStats.yellowCards * 0.45 -
    Math.floor(playerMatchStats.goalsConceded / 2) * (position === "POR" || position === "DEF" ? 0.75 : 0.35);

  const jitter = (stableHash(`${playerMatchStats.matchId}:${playerMatchStats.playerId}`) % 100) / 100;
  const score = performance + jitter;
  if (score >= 4.5) return 4;
  if (score >= 2.35) return 3;
  if (score >= 0.65) return 2;
  return 1;
};

export const buildPlayerPointBreakdown = (
  playerMatchStats: PlayerMatchStats,
  scoringRules: ScoringRules,
  position: PlayerPosition,
  showAll = false,
): PlayerPointBreakdownItem[] => {
  const doubleYellowCards = playerMatchStats.doubleYellowCards ?? Math.min(playerMatchStats.yellowCards, playerMatchStats.redCards);
  const directRedCards = Math.max(0, playerMatchStats.redCards - doubleYellowCards);
  const overloadRating = getOverloadRating(playerMatchStats, position);
  const overloadKey = String(overloadRating) as keyof ScoringRules["overloadRating"];
  const items: PlayerPointBreakdownItem[] = [];

  const add = (key: string, label: string, quantity: number | string, points: number, alwaysShow = false) => {
    if (showAll) {
      items.push({ key, label, quantity, points });
      return;
    }
    if (!showAll && !alwaysShow && (quantity === 0 || points === 0)) return;
    if (!showAll && (quantity === 0 && points === 0)) return;
    items.push({ key, label, quantity, points });
  };

  // Fuente de verdad de puntos: estadísticas editables/importadas, con reglas configurables por liga.
  add("played", playerMatchStats.minutes > 60 ? "Partido jugado (+60 min)" : "Partido jugado", playerMatchStats.minutes, playedPointsFor(scoringRules, playerMatchStats.minutes));
  add("goals", "Goles", playerMatchStats.goals, playerMatchStats.goals * scoringRules.goal[position]);
  add("assists", "Asistencias de gol", playerMatchStats.assists, playerMatchStats.assists * scoringRules.assist);
  add("keyPasses", "Asistencias sin gol", playerMatchStats.keyPasses ?? 0, (playerMatchStats.keyPasses ?? 0) * (scoringRules.keyPass ?? 1));
  add("ownGoals", "Goles en propia puerta", playerMatchStats.ownGoals, playerMatchStats.ownGoals * scoringRules.ownGoal);

  add(
    "cleanSheet",
    "Porteria a cero",
    playerMatchStats.cleanSheet && playerMatchStats.minutes > 60 ? 1 : 0,
    playerMatchStats.cleanSheet && playerMatchStats.minutes > 60 ? (scoringRules.cleanSheet[position] ?? 0) : 0,
  );

  add(
    "goalsConceded",
    "Goles recibidos",
    playerMatchStats.goalsConceded > 0 ? `${playerMatchStats.goalsConceded} recibidos` : 0,
    Math.floor(playerMatchStats.goalsConceded / 2) * concededRuleFor(scoringRules, position),
  );

  add("penaltiesMissed", "Penaltis fallados", playerMatchStats.penaltiesMissed, playerMatchStats.penaltiesMissed * scoringRules.penaltyMissed);
  add("penaltiesSaved", "Penaltis parados", playerMatchStats.penaltiesSaved, playerMatchStats.penaltiesSaved * scoringRules.penaltySaved);
  add(
    "penaltiesProvoked",
    "Penaltis provocados",
    playerMatchStats.penaltiesProvoked ?? 0,
    (playerMatchStats.penaltiesProvoked ?? 0) * scoringRules.penaltyProvoked,
  );
  add("yellowCards", "Tarjetas amarillas", playerMatchStats.yellowCards, playerMatchStats.yellowCards * scoringRules.yellowCard);
  add("doubleYellowCards", "Dobles amarillas", doubleYellowCards, doubleYellowCards * scoringRules.doubleYellowCard);
  add("redCards", "Rojas directas", directRedCards, directRedCards * scoringRules.redCard);
  if (position === "POR") add("saves", "Paradas del portero", playerMatchStats.saves ?? 0, perBlockPoints(playerMatchStats.saves, 2, scoringRules.savesEveryTwo ?? 1));
  add("overloadRating", "Nota Overload", playerMatchStats.overloadScore !== undefined ? `${playerMatchStats.overloadScore}/10` : overloadRating, scoringRules.overloadRating?.[overloadKey] ?? overloadRating);
  add(
    "shotsOnTarget",
    "Remates a puerta",
    playerMatchStats.shotsOnTarget ?? 0,
    perBlockPoints(playerMatchStats.shotsOnTarget, 2, scoringRules.shotsOnTargetEveryTwo ?? 1),
  );
  add(
    "successfulDribbles",
    "Regates logrados",
    playerMatchStats.successfulDribbles ?? 0,
    perBlockPoints(playerMatchStats.successfulDribbles, 2, scoringRules.successfulDribblesEveryTwo ?? 1),
  );
  add("boxEntries", "Llegadas al area", playerMatchStats.boxEntries ?? 0, perBlockPoints(playerMatchStats.boxEntries, 2, scoringRules.boxEntriesEveryTwo ?? 1));
  add("ballsLost", "Balones perdidos", playerMatchStats.ballsLost ?? 0, perBlockPoints(playerMatchStats.ballsLost, 10, scoringRules.ballsLostEveryTen ?? -1));
  add(
    "ballsRecovered",
    "Balones recuperados",
    playerMatchStats.ballsRecovered ?? 0,
    perBlockPoints(playerMatchStats.ballsRecovered, 5, scoringRules.ballsRecoveredEveryFive ?? 1),
  );
  add("clearances", "Despejes", playerMatchStats.clearances ?? 0, perBlockPoints(playerMatchStats.clearances, 5, scoringRules.clearancesEveryFive ?? 1));

  return items;
};

export const calculatePlayerFantasyPoints = (playerMatchStats: PlayerMatchStats, scoringRules: ScoringRules, position: PlayerPosition) =>
  buildPlayerPointBreakdown(playerMatchStats, scoringRules, position).reduce((sum, item) => sum + item.points, 0);

export const validateLineup = (players: Player[], starterIds: string[], formation: keyof typeof formationShape, matchdayNumber?: number) => {
  const errors: string[] = [];
  const shape = formationShape[formation];
  const starters = starterIds.map((playerId) => players.find((player) => player.id === playerId)).filter(Boolean) as Player[];
  const uniqueStarters = new Set(starterIds);

  if (!shape) errors.push("Formacion no valida.");
  if (starterIds.length !== uniqueStarters.size) errors.push("Hay jugadores repetidos en el once.");
  if (starters.length !== 11) errors.push("El once titular debe tener exactamente 11 jugadores.");

  const assignedPositions = shape ? assignLineupPositions(players, starterIds, formation) : null;
  if (shape && starters.length === 11 && !assignedPositions) {
    errors.push("La formacion no encaja con las posiciones disponibles de esos jugadores.");
  } else if (shape && assignedPositions) {
    (Object.keys(shape) as PlayerPosition[]).forEach((position) => {
      const count = Object.values(assignedPositions).filter((assignedPosition) => assignedPosition === position).length;
      if (count !== shape[position]) errors.push(`${position}: necesitas ${shape[position]} y tienes ${count}.`);
    });
  }

  const blocked = starters.filter((player) => isUnavailableForMatchday(player, matchdayNumber));
  if (blocked.length > 0) {
    errors.push(`No puedes alinear lesionados o sancionados: ${blocked.map((player) => player.name).join(", ")}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    assignedPositions: assignedPositions ?? {},
  };
};

export const calculateSquadValue = (players: Player[]) => players.reduce((sum, player) => sum + player.currentPrice, 0);
