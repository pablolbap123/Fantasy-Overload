export type PlayerPosition = "POR" | "DEF" | "MED" | "DEL";

export type PlayerStatus = "disponible" | "lesionado" | "sancionado" | "duda";

export interface PlayerStats {
  appearances: number;
  goals: number;
  assists: number;
  goalsConceded: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  doubleYellowCards: number;
  penaltiesScored: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
  penaltiesProvoked: number;
  ownGoals: number;
  mvps: number;
  overloadPoints: number;
  minutes: number;
  keyActions: number;
}

export interface Player {
  id: string;
  name: string;
  imageUrl?: string;
  teamId: string;
  teamName: string;
  position: PlayerPosition;
  basePrice: number;
  currentPrice: number;
  fantasyValue: number;
  totalPoints: number;
  pointsByMatchday: Record<number, number>;
  priceHistory?: Record<number, number>;
  status: PlayerStatus;
  unavailableUntilMatchday?: number | null;
  stats: PlayerStats;
}

export interface PlayerMatchStats {
  matchId: string;
  playerId: string;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  doubleYellowCards?: number;
  ownGoals: number;
  penaltiesScored: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
  penaltiesProvoked?: number;
  goalsConceded: number;
  cleanSheet: boolean;
  overloadRating?: number;
  mvp: boolean;
  teamWon: boolean;
  teamLost: boolean;
  highlighted: boolean;
  errorLedToGoal: boolean;
  fantasyPoints?: number;
}
