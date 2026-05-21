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

export const getOverloadRating = (playerMatchStats: PlayerMatchStats, position: PlayerPosition) => {
  if (typeof playerMatchStats.overloadRating === "number" && playerMatchStats.overloadRating > 0) {
    return Math.max(0, Math.min(4, Math.round(playerMatchStats.overloadRating)));
  }

  const doubleYellowCards = playerMatchStats.doubleYellowCards ?? Math.min(playerMatchStats.yellowCards, playerMatchStats.redCards);
  const directRedCards = Math.max(0, playerMatchStats.redCards - doubleYellowCards);
  const performance =
    playerMatchStats.goals * (position === "POR" || position === "DEF" ? 2.4 : position === "MED" ? 2.1 : 1.8) +
    playerMatchStats.assists * 1.55 +
    playerMatchStats.penaltiesSaved * 2.2 +
    (playerMatchStats.penaltiesProvoked ?? 0) * 1.3 +
    (playerMatchStats.cleanSheet ? (position === "POR" || position === "DEF" ? 1.1 : 0.55) : 0) -
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
): PlayerPointBreakdownItem[] => {
  const doubleYellowCards = playerMatchStats.doubleYellowCards ?? Math.min(playerMatchStats.yellowCards, playerMatchStats.redCards);
  const directRedCards = Math.max(0, playerMatchStats.redCards - doubleYellowCards);
  const overloadRating = getOverloadRating(playerMatchStats, position);
  const overloadKey = String(overloadRating) as keyof ScoringRules["overloadRating"];
  const items: PlayerPointBreakdownItem[] = [];

  const add = (key: string, label: string, quantity: number | string, points: number) => {
    if (quantity === 0 || points === 0) return;
    items.push({ key, label, quantity, points });
  };

  // Fuente de verdad de puntos: solo eventos que existen en Challenge, mas la Nota Overload generada.
  add("goals", "Goles", playerMatchStats.goals, playerMatchStats.goals * scoringRules.goal[position]);
  add("assists", "Asistencias de gol", playerMatchStats.assists, playerMatchStats.assists * scoringRules.assist);
  add("ownGoals", "Goles en propia puerta", playerMatchStats.ownGoals, playerMatchStats.ownGoals * scoringRules.ownGoal);

  if (playerMatchStats.cleanSheet) add("cleanSheet", "Porteria a cero", 1, scoringRules.cleanSheet[position] ?? 0);

  add(
    "goalsConceded",
    "Goles recibidos",
    Math.floor(playerMatchStats.goalsConceded / 2) > 0 ? `${playerMatchStats.goalsConceded} recibidos` : 0,
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
  add("overloadRating", "Nota Overload", overloadRating, scoringRules.overloadRating?.[overloadKey] ?? overloadRating);

  return items;
};

export const calculatePlayerFantasyPoints = (playerMatchStats: PlayerMatchStats, scoringRules: ScoringRules, position: PlayerPosition) =>
  buildPlayerPointBreakdown(playerMatchStats, scoringRules, position).reduce((sum, item) => sum + item.points, 0);

export const validateLineup = (players: Player[], starterIds: string[], formation: keyof typeof formationShape, matchdayNumber?: number) => {
  const errors: string[] = [];
  const shape = formationShape[formation];
  const starters = starterIds.map((playerId) => players.find((player) => player.id === playerId)).filter(Boolean) as Player[];
  const uniqueStarters = new Set(starterIds);

  if (starterIds.length !== uniqueStarters.size) errors.push("Hay jugadores repetidos en el once.");
  if (starters.length !== 11) errors.push("El once titular debe tener exactamente 11 jugadores.");

  (Object.keys(shape) as PlayerPosition[]).forEach((position) => {
    const count = starters.filter((player) => player.position === position).length;
    if (count !== shape[position]) {
      errors.push(`${position}: necesitas ${shape[position]} y tienes ${count}.`);
    }
  });

  const blocked = starters.filter((player) => isUnavailableForMatchday(player, matchdayNumber));
  if (blocked.length > 0) {
    errors.push(`No puedes alinear lesionados o sancionados: ${blocked.map((player) => player.name).join(", ")}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const calculateSquadValue = (players: Player[]) => players.reduce((sum, player) => sum + player.currentPrice, 0);
