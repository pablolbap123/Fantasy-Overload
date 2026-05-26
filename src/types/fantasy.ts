import type { PlayerPosition } from "./player";

export type Formation = "4-4-2" | "4-3-3" | "3-5-2" | "3-4-3" | "5-3-2" | "4-5-1";
export type LeagueRole = "admin" | "member";
export type MarketStatus = "market" | "owned" | "locked";
export type TransferType = "buy" | "sell" | "offer" | "offer_accepted" | "clause_buy" | "clause_raise" | "auction_win" | "league_offer";
export type OfferStatus = "pending" | "accepted" | "rejected" | "outbid";
export type OfferKind = "transfer" | "exchange";
export type BudgetEventType = "matchday_bonus" | "manual" | "correction";

export interface Profile {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface League {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  initialBudget: number;
  maxMembers: number;
  memberCount?: number;
  currentMatchday: number;
  marketLocked: boolean;
  lineupsLocked: boolean;
  createdAt: string;
}

export interface LeagueMember {
  id: string;
  leagueId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  role: LeagueRole;
  budget: number;
  totalPoints: number;
  lastMatchdayPoints: number;
  squadValue: number;
  pointsByMatchday: Record<number, number>;
  joinedMatchday: number;
  createdAt: string;
}

export interface LeaguePlayer {
  id: string;
  leagueId: string;
  playerId: string;
  ownerUserId?: string | null;
  listedByUserId?: string | null;
  marketStatus: MarketStatus;
  price: number;
  releaseClause: number;
  clauseLockedUntil?: string | null;
  marketListedAt?: string | null;
  marketExpiresAt?: string | null;
  createdAt: string;
}

export interface FantasySquad {
  userId: string;
  leagueId: string;
  playerIds: string[];
  starterIds: string[];
  benchIds: string[];
  injuredIds: string[];
  formation: Formation;
}

export interface LineupPlayer {
  playerId: string;
  slot: number;
  isStarter: boolean;
  position: PlayerPosition;
}

export interface Lineup {
  id: string;
  leagueId: string;
  userId: string;
  matchdayId: string;
  formation: Formation;
  status: "draft" | "submitted" | "locked";
  players: LineupPlayer[];
  captainPlayerId?: string | null;
  createdAt: string;
}

export interface Transfer {
  id: string;
  leagueId: string;
  userId: string;
  username: string;
  playerId: string;
  playerName: string;
  type: TransferType;
  amount: number;
  createdAt: string;
}

export interface BudgetEvent {
  id: string;
  leagueId: string;
  userId: string;
  type: BudgetEventType;
  matchdayNumber?: number | null;
  amount: number;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface Offer {
  id: string;
  leagueId: string;
  fromUserId: string;
  toUserId?: string | null;
  playerId: string;
  amount: number;
  kind: OfferKind;
  exchangePlayerId?: string | null;
  status: OfferStatus;
  createdAt: string;
}

export interface FantasyStanding {
  position: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  totalPoints: number;
  lastMatchdayPoints: number;
  squadValue: number;
  budget: number;
}

export interface ActivityItem {
  id: string;
  leagueId: string;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ChallengeSyncStatus {
  id: string;
  sourceUrl: string;
  status: "idle" | "checking" | "ok" | "changed" | "error";
  message: string;
  snapshotHash?: string | null;
  lastCheckedAt?: string | null;
  lastChangedAt?: string | null;
  updatedAt: string;
}

export interface ScoringRules {
  played?: number;
  sixtyMinutes?: number;
  playedUnder60?: number;
  playedOver60?: number;
  goal: Record<PlayerPosition, number>;
  assist: number;
  keyPass?: number;
  cleanSheet: Record<PlayerPosition, number>;
  goalsConcededEveryTwo: Record<PlayerPosition, number> | number;
  yellowCard: number;
  doubleYellowCard: number;
  redCard: number;
  ownGoal: number;
  penaltyScored?: number;
  penaltyMissed: number;
  penaltySaved: number;
  penaltyProvoked: number;
  savesEveryTwo?: number;
  overloadRating: Record<"0" | "1" | "2" | "3" | "4", number>;
  shotsOnTargetEveryTwo?: number;
  successfulDribblesEveryTwo?: number;
  boxEntriesEveryTwo?: number;
  ballsLostEach?: number;
  ballsRecoveredEach?: number;
  clearancesEach?: number;
  ballsLostEveryTen?: number;
  ballsRecoveredEveryFive?: number;
  clearancesEveryFive?: number;
  mvp?: number;
  teamWin?: number;
  teamLoss?: number;
  highlighted?: number;
  errorLedToGoal?: number;
}
