import type { ScoringRules } from "../types";

export const defaultScoringRules: ScoringRules = {
  goal: {
    POR: 6,
    DEF: 6,
    MED: 5,
    DEL: 4,
  },
  assist: 3,
  cleanSheet: {
    POR: 4,
    DEF: 4,
    MED: 2,
    DEL: 1,
  },
  goalsConcededEveryTwo: {
    POR: -2,
    DEF: -2,
    MED: -1,
    DEL: -1,
  },
  yellowCard: -1,
  doubleYellowCard: -1,
  redCard: -3,
  ownGoal: -2,
  penaltyMissed: -2,
  penaltySaved: 5,
  penaltyProvoked: 2,
  overloadRating: {
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
  },
};

export const scoringRuleLabels: Array<{ key: keyof ScoringRules | string; label: string; value: string }> = [
  { key: "goal.DEL", label: "Gol de delantero", value: "+4" },
  { key: "goal.MED", label: "Gol de centrocampista", value: "+5" },
  { key: "goal.DEF", label: "Gol de defensa", value: "+6" },
  { key: "goal.POR", label: "Gol de portero", value: "+6" },
  { key: "ownGoal", label: "Gol en propia puerta", value: "-2" },
  { key: "assist", label: "Asistencia de gol", value: "+3" },
  { key: "cleanSheet.POR", label: "Porteria a cero portero", value: "+4" },
  { key: "cleanSheet.DEF", label: "Porteria a cero defensa", value: "+4" },
  { key: "cleanSheet.MED", label: "Porteria a cero centrocampista", value: "+2" },
  { key: "cleanSheet.DEL", label: "Porteria a cero delantero", value: "+1" },
  { key: "goalsConcededEveryTwo.POR", label: "Cada 2 goles recibidos POR/DEF", value: "-2" },
  { key: "goalsConcededEveryTwo.MED", label: "Cada 2 goles recibidos MED/DEL", value: "-1" },
  { key: "penaltyMissed", label: "Penalti fallado", value: "-2" },
  { key: "penaltySaved", label: "Penalti parado", value: "+5" },
  { key: "penaltyProvoked", label: "Penalti provocado", value: "+2" },
  { key: "yellowCard", label: "Tarjeta amarilla", value: "-1" },
  { key: "doubleYellowCard", label: "Doble amarilla", value: "-1" },
  { key: "redCard", label: "Tarjeta roja directa", value: "-3" },
  { key: "overloadRating", label: "Nota Overload", value: "0 a +4" },
];
