import type { PlayerMatchStats } from "./player";

export type MatchStatus = "pendiente" | "en_curso" | "finalizada";
export type MatchdayStatus = "pendiente" | "en_curso" | "finalizada";

export type MatchEventType =
  | "goal"
  | "assist"
  | "yellow_card"
  | "red_card"
  | "mvp"
  | "penalty_scored"
  | "penalty_missed"
  | "penalty_saved"
  | "penalty_provoked"
  | "own_goal";

export interface MatchEvent {
  id: string;
  matchId: string;
  minute: number;
  type: MatchEventType;
  teamId: string;
  playerId?: string;
  relatedPlayerId?: string;
  description: string;
}

export interface Match {
  id: string;
  matchdayId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  playedAt: string;
  events: MatchEvent[];
  playerStats: PlayerMatchStats[];
}

export interface Matchday {
  id: string;
  leagueId: string;
  number: number;
  status: MatchdayStatus;
  startsAt: string;
  endsAt?: string;
  matches: Match[];
}
