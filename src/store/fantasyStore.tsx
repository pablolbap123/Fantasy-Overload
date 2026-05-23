/* eslint-disable react-refresh/only-export-components */
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { defaultScoringRules } from "../data/scoringRules";
import { mockMatchdays } from "../data/mockFixtures";
import { mockPlayers } from "../data/mockPlayers";
import { mockTeams } from "../data/mockTeams";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import type {
  ActivityItem,
<<<<<<< HEAD
=======
  BudgetEvent,
>>>>>>> 6bc6cc2 (Version 2.2)
  ChallengeSyncStatus,
  FantasyStanding,
  Formation,
  League,
  LeagueMember,
  LeaguePlayer,
  Lineup,
  LineupPlayer,
  Match,
  Matchday,
  Offer,
  Player,
  Profile,
  ScoringRules,
  Team,
  Transfer,
} from "../types";
import { calculateSquadValue, validateLineup } from "../utils/calculatePoints";
import { getAuthRedirectUrl } from "../utils/authRedirect";
import { getErrorMessage } from "../utils/errors";
import { formatMoney } from "../utils/formatters";
<<<<<<< HEAD
=======
import { sendFantasyNotification } from "../utils/notifications";
import { sendRemoteFantasyPush, setupFantasyPushNotifications } from "../utils/pushNotifications";
>>>>>>> 6bc6cc2 (Version 2.2)
import {
  DAILY_MARKET_SIZE,
  MARKET_DURATION_MS,
  getHighestBid,
  getNextBidAmount,
  normalizeDailyMarket,
  openDailyMarketCycle,
  resolveExpiredDailyMarket,
} from "../utils/market";
import { simulateMatch } from "../utils/simulateMatch";
import type { PlayerStatus } from "../types";

type ToastTone = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  message: string;
}

interface CreateLeagueInput {
  name: string;
  initialBudget: number;
  maxMembers: number;
  scoringRules: ScoringRules;
}

interface FantasyContextValue {
  session: Session | null;
  profile: Profile | null;
  userId: string | null;
  demoMode: boolean;
  onlineReady: boolean;
  loading: boolean;
  selectedLeagueId: string | null;
  currentLeague?: League;
  leagues: League[];
  teams: Team[];
  players: Player[];
  leaguePlayers: LeaguePlayer[];
  members: LeagueMember[];
  matchdays: Matchday[];
  lineups: Lineup[];
  transfers: Transfer[];
<<<<<<< HEAD
=======
  budgetEvents: BudgetEvent[];
>>>>>>> 6bc6cc2 (Version 2.2)
  offers: Offer[];
  activities: ActivityItem[];
  challengeSyncStatus?: ChallengeSyncStatus;
  scoringRules: ScoringRules;
  standings: FantasyStanding[];
  toasts: ToastMessage[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  dismissToast: (toastId: string) => void;
  selectLeague: (leagueId: string) => Promise<void>;
  createLeague: (input: CreateLeagueInput) => Promise<string | undefined>;
  joinLeague: (inviteCode: string) => Promise<void>;
  leaveLeague: (leagueId: string) => Promise<void>;
  deleteLeague: (leagueId: string) => Promise<void>;
  updateProfile: (input: { username: string; avatarUrl?: string }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  updateLeagueSettings: (patch: Partial<League> & { scoringRules?: ScoringRules }) => Promise<void>;
  isOverloadAdmin: boolean;
  updatePlayerAvailability: (playerId: string, status: PlayerStatus, unavailableUntilMatchday?: number | null) => Promise<void>;
  advanceLeagueMatchday: (matchdayNumber: number) => Promise<void>;
  buyPlayer: (playerId: string, amount?: number) => Promise<void>;
  sellPlayer: (playerId: string) => Promise<void>;
  listPlayerOnMarket: (playerId: string) => Promise<void>;
  cancelMarketListing: (playerId: string) => Promise<void>;
  raisePlayerClause: (playerId: string, spendAmount: number) => Promise<void>;
  makeOffer: (playerId: string, amount: number, exchangePlayerId?: string | null) => Promise<void>;
  refreshDailyMarket: () => Promise<void>;
  acceptOffer: (offerId: string) => Promise<void>;
  rejectOffer: (offerId: string) => Promise<void>;
<<<<<<< HEAD
=======
  cancelOffer: (offerId: string) => Promise<void>;
>>>>>>> 6bc6cc2 (Version 2.2)
  submitLineup: (formation: Formation, starterIds: string[], benchIds: string[], matchdayNumber?: number) => Promise<void>;
  requestChallengeSync: () => Promise<void>;
  simulateCurrentMatchday: () => Promise<void>;
  updateMatchResult: (match: Match) => Promise<void>;
  resetDemoSeason: () => void;
  exportLeagueData: () => string;
  importDemoData: (json: string) => void;
}

interface DemoSnapshot {
  profile: Profile;
  leagues: League[];
  selectedLeagueId: string;
  members: LeagueMember[];
  leaguePlayers: LeaguePlayer[];
  matchdays: Matchday[];
  lineups: Lineup[];
  transfers: Transfer[];
<<<<<<< HEAD
=======
  budgetEvents: BudgetEvent[];
>>>>>>> 6bc6cc2 (Version 2.2)
  offers: Offer[];
  activities: ActivityItem[];
  scoringRules: ScoringRules;
  players: Player[];
}

const demoUserId = "demo-user";
const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const makeInviteCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const supabasePageSize = 1000;
const supabaseQueryTimeoutMs = 20_000;
const releaseClauseFor = (price: number) => Math.round((price * 1.2) / 50_000) * 50_000;
const clauseRaiseIncrease = (spendAmount: number) => Math.round((Math.max(spendAmount, 0) * 3) / 50_000) * 50_000;
const clauseLockUntil = () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

const withSupabaseTimeout = async <T,>(query: PromiseLike<T>, label = "Supabase") =>
  new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(`${label} no respondio a tiempo.`));
    }, supabaseQueryTimeoutMs);
    Promise.resolve(query)
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeout));
  });

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const fetchRows = async (query: PromiseLike<{ data: any[] | null; error: unknown }>) => {
  const { data, error } = await withSupabaseTimeout(query);
  if (error) throw error;
  return data ?? [];
};

const fetchMaybeRow = async (query: PromiseLike<{ data: any | null; error: unknown }>) => {
  const { data, error } = await withSupabaseTimeout(query);
  if (error) throw error;
  return data ?? null;
};

const fetchAllRows = async (makeQuery: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>) => {
  const rows: any[] = [];
  for (let from = 0; ; from += supabasePageSize) {
    const page = await fetchRows(makeQuery(from, from + supabasePageSize - 1));
    rows.push(...page);
    if (page.length < supabasePageSize) return rows;
  }
};

const defaultStarterIds = (players: Player[]) => {
  const por = players.filter((player) => player.position === "POR").slice(0, 1);
  const def = players.filter((player) => player.position === "DEF").slice(0, 4);
  const med = players.filter((player) => player.position === "MED").slice(0, 4);
  const del = players.filter((player) => player.position === "DEL").slice(0, 2);
  return [...por, ...def, ...med, ...del].map((player) => player.id);
};

const buildDemoSnapshot = (): DemoSnapshot => {
  const players = clone(mockPlayers);
  const bolsaTeam = mockTeams.find((team) => team.shortName === "BLSA");
  const clubPlayers = players.filter((player) => player.teamId !== bolsaTeam?.id);
  const now = new Date().toISOString();
  const league: League = {
    id: "league-demo",
    name: "Overload Friends League",
    inviteCode: "OVER26",
    ownerId: demoUserId,
    initialBudget: 250_000_000,
    maxMembers: 12,
    memberCount: 1,
    currentMatchday: 8,
    marketLocked: false,
    lineupsLocked: false,
    createdAt: now,
  };

  const mySquad = [
    ...clubPlayers.filter((player) => player.position === "POR").slice(0, 2),
    ...clubPlayers.filter((player) => player.position === "DEF").slice(0, 6),
    ...clubPlayers.filter((player) => player.position === "MED").slice(0, 6),
    ...clubPlayers.filter((player) => player.position === "DEL").slice(0, 4),
  ];
  mySquad.forEach((player) => {
    player.status = "disponible";
  });
  const ownerByPlayer = new Map<string, string>();
  mySquad.forEach((player) => ownerByPlayer.set(player.id, demoUserId));

  const leaguePlayers = openDailyMarketCycle(players.map((player) => ({
    id: `league-player-${player.id}`,
    leagueId: league.id,
    playerId: player.id,
    ownerUserId: ownerByPlayer.get(player.id) ?? null,
    listedByUserId: null,
    marketStatus: ownerByPlayer.has(player.id) ? "owned" : "market",
    price: player.currentPrice,
    releaseClause: releaseClauseFor(player.currentPrice),
    clauseLockedUntil: ownerByPlayer.has(player.id) ? clauseLockUntil() : null,
    marketListedAt: null,
    marketExpiresAt: null,
    createdAt: now,
  })) satisfies LeaguePlayer[], players, new Date(now));

  const userSquadValue = calculateSquadValue(mySquad);
  const members: LeagueMember[] = [
    {
      id: "member-demo",
      leagueId: league.id,
      userId: demoUserId,
      username: "Tú",
      avatarUrl: "",
      role: "admin",
      budget: league.initialBudget - userSquadValue,
      totalPoints: 0,
      lastMatchdayPoints: 0,
      squadValue: userSquadValue,
      pointsByMatchday: {},
      joinedMatchday: league.currentMatchday,
      createdAt: now,
    },
  ];

  const starterIds = defaultStarterIds(mySquad);
  const benchIds = mySquad.filter((player) => !starterIds.includes(player.id)).map((player) => player.id);
  const lineups: Lineup[] = [
    {
      id: "lineup-demo-1",
      leagueId: league.id,
      userId: demoUserId,
      matchdayId: "matchday-6",
      formation: "4-4-2",
      status: "submitted",
      players: [
        ...starterIds.map((playerId, slot) => {
          const player = players.find((item) => item.id === playerId)!;
          return { playerId, slot, isStarter: true, position: player.position } satisfies LineupPlayer;
        }),
        ...benchIds.map((playerId, index) => {
          const player = players.find((item) => item.id === playerId)!;
          return { playerId, slot: 11 + index, isStarter: false, position: player.position } satisfies LineupPlayer;
        }),
      ],
      createdAt: now,
    },
  ];

  return {
    profile: {
      id: "profile-demo",
      userId: demoUserId,
      username: "Manager Overload",
      avatarUrl: "",
      createdAt: now,
    },
    leagues: [league],
    selectedLeagueId: league.id,
    members,
    leaguePlayers,
    matchdays: clone(mockMatchdays),
    lineups,
    transfers: [
      {
        id: "transfer-demo-1",
        leagueId: league.id,
        userId: demoUserId,
        username: "Tú",
        playerId: mySquad[0].id,
        playerName: mySquad[0].name,
        type: "buy",
        amount: mySquad[0].currentPrice,
        createdAt: now,
      },
    ],
<<<<<<< HEAD
=======
    budgetEvents: [],
>>>>>>> 6bc6cc2 (Version 2.2)
    offers: [],
    activities: [
      {
        id: "activity-demo-1",
        leagueId: league.id,
        type: "league_created",
        message: "Liga demo creada con código OVER26.",
        createdAt: now,
      },
      {
        id: "activity-demo-2",
        leagueId: league.id,
        type: "market",
        message: "El mercado compartido ya tiene jugadores disponibles.",
        createdAt: now,
      },
    ],
    scoringRules: clone(defaultScoringRules),
    players,
  };
};

const mapLeague = (row: any): League => ({
  id: row.id,
  name: row.name,
  inviteCode: row.invite_code,
  ownerId: row.owner_id,
  initialBudget: Number(row.initial_budget),
  maxMembers: Number(row.max_members),
  memberCount: row.member_count === undefined || row.member_count === null ? undefined : Number(row.member_count),
  currentMatchday: Number(row.current_matchday),
  marketLocked: Boolean(row.market_locked),
  lineupsLocked: Boolean(row.lineups_locked),
  createdAt: row.created_at,
});

const mapChallengeSyncStatus = (row: any): ChallengeSyncStatus => ({
  id: row.id,
  sourceUrl: row.source_url,
  status: row.status,
  message: row.message,
  snapshotHash: row.snapshot_hash,
  lastCheckedAt: row.last_checked_at,
  lastChangedAt: row.last_changed_at,
  updatedAt: row.updated_at,
});

const mapPlayer = (row: any): Player => ({
  id: row.id,
  name: row.name,
  imageUrl: row.image_url ?? "",
  teamId: row.team_id,
  teamName: row.teams?.name ?? row.team_name ?? "Sin equipo",
  position: row.position,
  basePrice: Number(row.base_price),
  currentPrice: Number(row.current_price),
  fantasyValue: Number(row.fantasy_value ?? 0),
  totalPoints: Number(row.total_points ?? 0),
  pointsByMatchday: row.points_by_matchday ?? {},
  priceHistory: row.stats_json?.priceHistory ?? row.stats_json?.price_history ?? {},
  status: row.status,
  unavailableUntilMatchday:
    row.unavailable_until_matchday === undefined || row.unavailable_until_matchday === null
      ? null
      : Number(row.unavailable_until_matchday),
  stats: {
    appearances: Number(row.stats_json?.appearances ?? 0),
    goals: Number(row.stats_json?.goals ?? 0),
    assists: Number(row.stats_json?.assists ?? 0),
    goalsConceded: Number(row.stats_json?.goalsConceded ?? row.stats_json?.goals_conceded ?? 0),
    cleanSheets: Number(row.stats_json?.cleanSheets ?? row.stats_json?.clean_sheets ?? 0),
    yellowCards: Number(row.stats_json?.yellowCards ?? row.stats_json?.yellow_cards ?? 0),
    redCards: Number(row.stats_json?.redCards ?? row.stats_json?.red_cards ?? 0),
    doubleYellowCards: Number(row.stats_json?.doubleYellowCards ?? row.stats_json?.double_yellow_cards ?? 0),
    penaltiesScored: Number(row.stats_json?.penaltiesScored ?? row.stats_json?.penalties_scored ?? 0),
    penaltiesMissed: Number(row.stats_json?.penaltiesMissed ?? row.stats_json?.penalties_missed ?? 0),
    penaltiesSaved: Number(row.stats_json?.penaltiesSaved ?? row.stats_json?.penalties_saved ?? 0),
    penaltiesProvoked: Number(row.stats_json?.penaltiesProvoked ?? row.stats_json?.penalties_provoked ?? 0),
    ownGoals: Number(row.stats_json?.ownGoals ?? row.stats_json?.own_goals ?? 0),
    mvps: Number(row.stats_json?.mvps ?? 0),
    overloadPoints: Number(row.stats_json?.overloadPoints ?? row.stats_json?.overload_points ?? 0),
    minutes: Number(row.stats_json?.minutes ?? 0),
    keyActions: Number(row.stats_json?.keyActions ?? row.stats_json?.key_actions ?? 0),
  },
});

const mapMatch = (row: any): Match => ({
  id: row.id,
  matchdayId: row.matchday_id,
  homeTeamId: row.home_team_id,
  awayTeamId: row.away_team_id,
  homeTeamName: row.home_team?.name ?? row.home_team_name ?? "Local",
  awayTeamName: row.away_team?.name ?? row.away_team_name ?? "Visitante",
  homeScore: row.home_score,
  awayScore: row.away_score,
  status: row.status,
  playedAt: row.played_at,
  events: row.events ?? [],
  playerStats: (row.player_match_stats ?? []).map((stat: any) => ({
    matchId: stat.match_id,
    playerId: stat.player_id,
    minutes: Number(stat.minutes ?? 0),
    goals: Number(stat.goals ?? 0),
    assists: Number(stat.assists ?? 0),
    yellowCards: Number(stat.yellow_cards ?? 0),
    redCards: Number(stat.red_cards ?? 0),
    doubleYellowCards: Number(stat.double_yellow_cards ?? 0),
    ownGoals: Number(stat.own_goals ?? 0),
    penaltiesScored: Number(stat.penalties_scored ?? 0),
    penaltiesMissed: Number(stat.penalties_missed ?? 0),
    penaltiesSaved: Number(stat.penalties_saved ?? 0),
    penaltiesProvoked: Number(stat.penalties_provoked ?? 0),
    goalsConceded: Number(stat.goals_conceded ?? 0),
    cleanSheet: Boolean(stat.clean_sheet),
    overloadRating: Number(stat.overload_rating ?? 0),
    mvp: Boolean(stat.mvp),
    teamWon: Boolean(stat.team_won ?? false),
    teamLost: Boolean(stat.team_lost ?? false),
    highlighted: Boolean(stat.highlighted ?? false),
    errorLedToGoal: Boolean(stat.error_led_to_goal ?? false),
    fantasyPoints: Number(stat.fantasy_points ?? 0),
  })),
});

const FantasyContext = createContext<FantasyContextValue | undefined>(undefined);

export const FantasyProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>(mockTeams);
  const [players, setPlayers] = useState<Player[]>(mockPlayers);
  const [leaguePlayers, setLeaguePlayers] = useState<LeaguePlayer[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
<<<<<<< HEAD
=======
  const [budgetEvents, setBudgetEvents] = useState<BudgetEvent[]>([]);
>>>>>>> 6bc6cc2 (Version 2.2)
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [challengeSyncStatus, setChallengeSyncStatus] = useState<ChallengeSyncStatus | undefined>();
  const [scoringRules, setScoringRules] = useState<ScoringRules>(defaultScoringRules);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const reloadTimerRef = useRef<number | null>(null);
<<<<<<< HEAD

  const userId = demoMode ? demoUserId : session?.user.id ?? null;
  const onlineReady = Boolean(isSupabaseConfigured && supabase && session && !demoMode);
  const isOverloadAdmin = session?.user.email?.toLowerCase() === "pablogarvac@gmail.com";
=======
  const notificationLeagueRef = useRef<string | null>(null);
  const pushRegistrationRef = useRef<string | null>(null);
  const knownNotificationTransferIdsRef = useRef<Set<string>>(new Set());
  const knownNotificationActivityIdsRef = useRef<Set<string>>(new Set());

  const userId = demoMode ? demoUserId : session?.user.id ?? null;
  const onlineReady = Boolean(isSupabaseConfigured && supabase && session && !demoMode);
  const isOverloadAdmin = Boolean(session?.user.email?.toLowerCase().startsWith("pablogarvac"));
>>>>>>> 6bc6cc2 (Version 2.2)

  const pushToast = useCallback((message: string, tone: ToastTone = "info") => {
    const toast: ToastMessage = { id: randomId("toast"), tone, message };
    setToasts((current) => [...current, toast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 4200);
  }, []);

  const applyDemoSnapshot = useCallback((snapshot: DemoSnapshot) => {
    setProfile(snapshot.profile);
    setLeagues(snapshot.leagues);
    setSelectedLeagueId(snapshot.selectedLeagueId);
    setMembers(snapshot.members);
    setLeaguePlayers(snapshot.leaguePlayers);
    setMatchdays(snapshot.matchdays);
    setLineups(snapshot.lineups);
    setTransfers(snapshot.transfers);
<<<<<<< HEAD
=======
    setBudgetEvents(snapshot.budgetEvents);
>>>>>>> 6bc6cc2 (Version 2.2)
    setOffers(snapshot.offers);
    setActivities(snapshot.activities);
    setChallengeSyncStatus(undefined);
    setScoringRules(snapshot.scoringRules);
    setPlayers(snapshot.players);
    setTeams(mockTeams);
  }, []);

  const ensureProfile = useCallback(
    async (currentSession: Session) => {
      if (!supabase) return null;
      const { data: existing, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", currentSession.user.id)
        .maybeSingle();
      if (error) throw error;
      if (existing) {
        const mapped = {
          id: existing.id,
          userId: existing.user_id,
          username: existing.username,
          avatarUrl: existing.avatar_url ?? "",
          createdAt: existing.created_at,
        } satisfies Profile;
        setProfile(mapped);
        return mapped;
      }

      const username =
        currentSession.user.user_metadata?.username ??
        currentSession.user.email?.split("@")[0] ??
        `Manager ${currentSession.user.id.slice(0, 4)}`;
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .insert({ user_id: currentSession.user.id, username })
        .select("*")
        .single();
      if (createError) throw createError;
      const mapped = {
        id: created.id,
        userId: created.user_id,
        username: created.username,
        avatarUrl: created.avatar_url ?? "",
        createdAt: created.created_at,
      } satisfies Profile;
      setProfile(mapped);
      return mapped;
    },
    [],
  );

  const loadLeagueData = useCallback(
    async (leagueId: string) => {
      const client = supabase;
      if (!client || !session) return;
      try {
        const [
          teamsRows,
          playerRows,
          leaguePlayerRows,
          memberRows,
          matchdayRows,
          lineupRows,
          transferRows,
<<<<<<< HEAD
=======
          budgetEventRows,
>>>>>>> 6bc6cc2 (Version 2.2)
          offerRows,
          activityRows,
          scoringRow,
          syncStatusRow,
        ] = await Promise.all([
          fetchRows(client.from("teams").select("*").order("name")),
          fetchAllRows((from, to) =>
            client.from("players").select("*, teams(name)").order("current_price", { ascending: false }).order("id").range(from, to),
          ),
          fetchAllRows((from, to) => client.from("league_players").select("*").eq("league_id", leagueId).order("id").range(from, to)),
          fetchRows(client.from("league_members").select("*, profiles(username, avatar_url)").eq("league_id", leagueId)),
          fetchRows(
            client
              .from("matchdays")
              .select("*, matches(*, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name), player_match_stats(*))")
              .eq("league_id", leagueId)
              .order("number"),
          ),
          fetchRows(
            client
              .from("lineups")
              .select("*, lineup_players(*)")
              .eq("league_id", leagueId)
              .eq("user_id", session.user.id),
          ),
          fetchRows(
            client
              .from("transfers")
              .select("*, players(name), profiles(username)")
              .eq("league_id", leagueId)
              .order("created_at", { ascending: false })
<<<<<<< HEAD
              .limit(40),
          ),
=======
              .limit(120),
          ),
          fetchRows(
            client
              .from("budget_events")
              .select("*")
              .eq("league_id", leagueId)
              .eq("user_id", session.user.id)
              .order("created_at", { ascending: false })
              .limit(120),
          ).catch(() => []),
>>>>>>> 6bc6cc2 (Version 2.2)
          fetchRows(client.from("offers").select("*").eq("league_id", leagueId).order("created_at", { ascending: false })),
          fetchRows(
            client
              .from("activity_feed")
              .select("*")
              .eq("league_id", leagueId)
              .order("created_at", { ascending: false })
              .limit(60),
          ),
          fetchMaybeRow(client.from("scoring_rules").select("*").eq("league_id", leagueId).maybeSingle()),
          fetchMaybeRow(client.from("challenge_sync_status").select("*").eq("id", "overload-series").maybeSingle()).catch(() => null),
        ]);

        const mappedTeams = teamsRows.map((row: any) => ({
          id: row.id,
          name: row.name,
          shortName: row.short_name,
          color: row.color,
          badgeUrl: row.badge_url ?? "",
          strength: Number(row.strength ?? 75),
        })) satisfies Team[];
        const mappedPlayers = playerRows.map(mapPlayer);
        const mappedLeaguePlayers = normalizeDailyMarket(leaguePlayerRows.map((row: any) => ({
          id: row.id,
          leagueId: row.league_id,
          playerId: row.player_id,
          ownerUserId: row.owner_user_id,
          listedByUserId: row.listed_by_user_id,
          marketStatus: row.market_status,
          price: Number(row.price),
          releaseClause:
            row.release_clause && Number(row.release_clause) > 0 ? Number(row.release_clause) : releaseClauseFor(Number(row.price)),
          clauseLockedUntil: row.clause_locked_until,
          marketListedAt: row.market_listed_at,
          marketExpiresAt: row.market_expires_at,
          createdAt: row.created_at,
        })) satisfies LeaguePlayer[], mappedPlayers);
        const mappedMembers = memberRows.map((row: any) => {
          const ownedPlayers = mappedLeaguePlayers
            .filter((leaguePlayer) => leaguePlayer.ownerUserId === row.user_id)
            .map((leaguePlayer) => mappedPlayers.find((player) => player.id === leaguePlayer.playerId))
            .filter(Boolean) as Player[];
          return {
            id: row.id,
            leagueId: row.league_id,
            userId: row.user_id,
            username: row.profiles?.username ?? "Manager",
            avatarUrl: row.profiles?.avatar_url ?? "",
            role: row.role,
            budget: Number(row.budget),
            totalPoints: Number(row.total_points ?? 0),
            lastMatchdayPoints: Number(row.last_matchday_points ?? 0),
            squadValue: calculateSquadValue(ownedPlayers),
            pointsByMatchday: row.points_by_matchday ?? {},
            joinedMatchday: Number(row.joined_matchday ?? 1),
            createdAt: row.created_at,
          } satisfies LeagueMember;
        });
        const mappedMatchdays = matchdayRows.map((row: any) => ({
          id: row.id,
          leagueId: row.league_id,
          number: Number(row.number),
          status: row.status,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          matches: (row.matches ?? []).map(mapMatch),
        })) satisfies Matchday[];
        const mappedLineups = lineupRows.map((row: any) => ({
          id: row.id,
          leagueId: row.league_id,
          userId: row.user_id,
          matchdayId: row.matchday_id,
          formation: row.formation,
          status: row.status,
          createdAt: row.created_at,
          players: (row.lineup_players ?? [])
            .map((lineupPlayer: any) => ({
              playerId: lineupPlayer.player_id,
              slot: Number(lineupPlayer.slot),
              isStarter: Boolean(lineupPlayer.is_starter),
              position: lineupPlayer.position,
            }))
            .sort((a: LineupPlayer, b: LineupPlayer) => a.slot - b.slot),
        })) satisfies Lineup[];
        const mappedTransfers = transferRows.map((row: any) => ({
          id: row.id,
          leagueId: row.league_id,
          userId: row.user_id,
          username: row.profiles?.username ?? "Manager",
          playerId: row.player_id,
          playerName: row.players?.name ?? "Jugador",
          type: row.type,
          amount: Number(row.amount),
          createdAt: row.created_at,
        })) satisfies Transfer[];
<<<<<<< HEAD
=======
        const mappedBudgetEvents = budgetEventRows.map((row: any) => ({
          id: row.id,
          leagueId: row.league_id,
          userId: row.user_id,
          type: row.type,
          matchdayNumber:
            row.matchday_number === undefined || row.matchday_number === null ? null : Number(row.matchday_number),
          amount: Number(row.amount),
          description: row.description,
          metadata: row.metadata_json,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })) satisfies BudgetEvent[];
>>>>>>> 6bc6cc2 (Version 2.2)
        const mappedOffers = offerRows.map((row: any) => ({
          id: row.id,
          leagueId: row.league_id,
          fromUserId: row.from_user_id,
          toUserId: row.to_user_id,
          playerId: row.player_id,
          amount: Number(row.amount),
          kind: row.kind ?? "transfer",
          exchangePlayerId: row.exchange_player_id,
          status: row.status,
          createdAt: row.created_at,
        })) satisfies Offer[];
        const mappedActivities = activityRows.map((row: any) => ({
          id: row.id,
          leagueId: row.league_id,
          type: row.type,
          message: row.message,
          metadata: row.metadata_json,
          createdAt: row.created_at,
        })) satisfies ActivityItem[];

        setTeams(mappedTeams);
        setPlayers(mappedPlayers);
        setLeaguePlayers(mappedLeaguePlayers);
        setMembers(mappedMembers);
        setLeagues((current) =>
          current.map((league) => (league.id === leagueId ? { ...league, memberCount: mappedMembers.length } : league)),
        );
        setMatchdays(mappedMatchdays);
        setLineups(mappedLineups);
        setTransfers(mappedTransfers);
<<<<<<< HEAD
=======
        setBudgetEvents(mappedBudgetEvents);
>>>>>>> 6bc6cc2 (Version 2.2)
        setOffers(mappedOffers);
        setActivities(mappedActivities);
        setChallengeSyncStatus(syncStatusRow ? mapChallengeSyncStatus(syncStatusRow) : undefined);
        setScoringRules((scoringRow?.rules_json as ScoringRules) ?? defaultScoringRules);
      } catch (error) {
        pushToast(getErrorMessage(error, "No se pudo cargar la liga."), "error");
      }
    },
    [pushToast, session],
  );

  const loadLeagues = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    try {
      await ensureProfile(session);
      const { data, error } = await supabase
        .from("league_members")
        .select("leagues(*)")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const mapped = (data ?? []).map((row: any) => mapLeague(row.leagues)).filter(Boolean);
      const leagueIds = mapped.map((league) => league.id);
      if (leagueIds.length > 0) {
        const { data: memberRows, error: membersError } = await supabase.from("league_members").select("league_id").in("league_id", leagueIds);
        if (membersError) throw membersError;
        const counts = new Map<string, number>();
        (memberRows ?? []).forEach((row: any) => counts.set(row.league_id, (counts.get(row.league_id) ?? 0) + 1));
        mapped.forEach((league) => {
          league.memberCount = counts.get(league.id) ?? 0;
        });
      }
      setLeagues(mapped);
      const nextLeagueId = selectedLeagueId && mapped.some((league) => league.id === selectedLeagueId)
        ? selectedLeagueId
        : mapped[0]?.id ?? null;
      setSelectedLeagueId(nextLeagueId);
      if (nextLeagueId) await loadLeagueData(nextLeagueId);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "No se pudieron cargar tus ligas.", "error");
    } finally {
      setLoading(false);
    }
  }, [ensureProfile, loadLeagueData, pushToast, selectedLeagueId, session]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let settled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!settled && !cancelled) setLoading(false);
    }, 8000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        if (!data.session) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      })
      .finally(() => {
        settled = true;
        window.clearTimeout(fallbackTimer);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setLeagues([]);
        setSelectedLeagueId(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      listener.subscription.unsubscribe();
    };
  }, [applyDemoSnapshot]);

  useEffect(() => {
    if (session && !demoMode) {
      void loadLeagues();
    }
  }, [demoMode, loadLeagues, session]);

  useEffect(() => {
<<<<<<< HEAD
=======
    if (!onlineReady || !supabase || !session?.user.id) return;
    if (pushRegistrationRef.current === session.user.id) return;
    pushRegistrationRef.current = session.user.id;
    void setupFantasyPushNotifications(supabase, session.user.id).catch((error) => {
      console.warn("No se pudo activar FCM", error);
    });
  }, [onlineReady, session?.user.id]);

  useEffect(() => {
>>>>>>> 6bc6cc2 (Version 2.2)
    const client = supabase;
    if (!onlineReady || !selectedLeagueId || !client) return;
    const scheduleReload = () => {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => {
        void loadLeagueData(selectedLeagueId);
      }, 350);
    };
    const channel = client
      .channel(`league-${selectedLeagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "league_members", filter: `league_id=eq.${selectedLeagueId}` },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "league_players", filter: `league_id=eq.${selectedLeagueId}` },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_feed", filter: `league_id=eq.${selectedLeagueId}` },
        scheduleReload,
      )
      .on(
        "postgres_changes",
<<<<<<< HEAD
=======
        { event: "*", schema: "public", table: "budget_events", filter: `league_id=eq.${selectedLeagueId}` },
        scheduleReload,
      )
      .on(
        "postgres_changes",
>>>>>>> 6bc6cc2 (Version 2.2)
        { event: "*", schema: "public", table: "matchdays", filter: `league_id=eq.${selectedLeagueId}` },
        scheduleReload,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_match_stats" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_sync_status" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      void client.removeChannel(channel);
    };
  }, [loadLeagueData, onlineReady, selectedLeagueId]);

  const currentLeague = leagues.find((league) => league.id === selectedLeagueId);

<<<<<<< HEAD
=======
  useEffect(() => {
    if (!currentLeague?.id || !userId) return;

    const leagueTransferIds = new Set(
      transfers.filter((transfer) => transfer.leagueId === currentLeague.id).map((transfer) => transfer.id),
    );
    const leagueActivityIds = new Set(
      activities.filter((activity) => activity.leagueId === currentLeague.id).map((activity) => activity.id),
    );

    if (notificationLeagueRef.current !== currentLeague.id) {
      notificationLeagueRef.current = currentLeague.id;
      knownNotificationTransferIdsRef.current = leagueTransferIds;
      knownNotificationActivityIdsRef.current = leagueActivityIds;
      return;
    }

    const newTransfers = transfers.filter(
      (transfer) =>
        transfer.leagueId === currentLeague.id &&
        !knownNotificationTransferIdsRef.current.has(transfer.id) &&
        transfer.userId === userId &&
        ["buy", "clause_buy", "auction_win", "offer_accepted"].includes(transfer.type),
    );
    const newActivities = activities.filter(
      (activity) => activity.leagueId === currentLeague.id && !knownNotificationActivityIdsRef.current.has(activity.id),
    );

    knownNotificationTransferIdsRef.current = leagueTransferIds;
    knownNotificationActivityIdsRef.current = leagueActivityIds;

    newTransfers.forEach((transfer) => {
      void sendFantasyNotification(`🛒 Has fichado a: ${transfer.playerName}`);
    });

    newActivities.forEach((activity) => {
      const metadata = activity.metadata ?? {};
      const previousOwner = typeof metadata.previous_owner === "string" ? metadata.previous_owner : null;
      if (previousOwner !== userId) return;

      const playerId = typeof metadata.player_id === "string" ? metadata.player_id : null;
      const buyerId = typeof metadata.user_id === "string" ? metadata.user_id : null;
      const playerName = players.find((player) => player.id === playerId)?.name ?? "Jugador";
      const buyerName = members.find((member) => member.userId === buyerId)?.username ?? "Alguien";
      void sendFantasyNotification(`‼️ ${buyerName} te ha robado un jugador: ${playerName}`);
    });
  }, [activities, currentLeague?.id, members, players, transfers, userId]);

>>>>>>> 6bc6cc2 (Version 2.2)
  const standings = useMemo(
    () =>
      [...members]
        .sort((a, b) => b.totalPoints - a.totalPoints || b.lastMatchdayPoints - a.lastMatchdayPoints)
        .map((member, index) => ({
          position: index + 1,
          userId: member.userId,
          username: member.username,
          avatarUrl: member.avatarUrl,
          totalPoints: member.totalPoints,
          lastMatchdayPoints: member.lastMatchdayPoints,
          squadValue: member.squadValue,
          budget: member.budget,
        })),
    [members],
  );

  const selectLeague = useCallback(
    async (leagueId: string) => {
      setSelectedLeagueId(leagueId);
      if (onlineReady) await loadLeagueData(leagueId);
    },
    [loadLeagueData, onlineReady],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        throw new Error("Supabase no esta configurado. Anade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para jugar online.");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setDemoMode(false);
    },
    [],
  );

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    if (error) throw error;
    setDemoMode(false);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl(),
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase && !demoMode) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setDemoMode(false);
    setProfile(null);
    setLeagues([]);
    setSelectedLeagueId(null);
  }, [demoMode]);

  const createLeague = useCallback(
    async (input: CreateLeagueInput) => {
      if (onlineReady && supabase) {
        const { data, error } = await supabase.rpc("create_league", {
          p_name: input.name,
          p_initial_budget: input.initialBudget,
          p_max_members: input.maxMembers,
          p_rules: input.scoringRules,
        });
        if (error) throw new Error(getErrorMessage(error, "No se pudo crear la liga en Supabase."));
        await loadLeagues();
        pushToast("Liga creada. Comparte el código con tus amigos.", "success");
        return data as string;
      }

      const leagueId = randomId("league");
      const league: League = {
        id: leagueId,
        name: input.name,
        inviteCode: makeInviteCode(),
        ownerId: demoUserId,
        initialBudget: input.initialBudget,
        maxMembers: input.maxMembers,
        memberCount: 1,
        currentMatchday: 8,
        marketLocked: false,
        lineupsLocked: false,
        createdAt: new Date().toISOString(),
      };
      setLeagues((current) => [league, ...current]);
      setSelectedLeagueId(leagueId);
      setMembers([
        {
          id: randomId("member"),
          leagueId,
          userId: demoUserId,
          username: profile?.username ?? "Tú",
          role: "admin",
          budget: input.initialBudget,
          totalPoints: 0,
          lastMatchdayPoints: 0,
          squadValue: 0,
          pointsByMatchday: {},
          joinedMatchday: league.currentMatchday,
          createdAt: league.createdAt,
        },
      ]);
      setLeaguePlayers(
        openDailyMarketCycle(players.map((player) => ({
          id: randomId("league-player"),
          leagueId,
          playerId: player.id,
          ownerUserId: null,
          listedByUserId: null,
          marketStatus: "market",
          price: player.currentPrice,
          releaseClause: releaseClauseFor(player.currentPrice),
          clauseLockedUntil: null,
          marketListedAt: null,
          marketExpiresAt: null,
          createdAt: league.createdAt,
        })) satisfies LeaguePlayer[], players, new Date(league.createdAt)),
      );
      setMatchdays(clone(mockMatchdays).map((matchday) => ({ ...matchday, leagueId })));
      setLineups([]);
      setTransfers([]);
      setOffers([]);
      setActivities([
        {
          id: randomId("activity"),
          leagueId,
          type: "league_created",
          message: `Liga ${input.name} creada con código ${league.inviteCode}.`,
          createdAt: league.createdAt,
        },
      ]);
      setScoringRules(input.scoringRules);
      pushToast("Liga demo creada.", "success");
      return leagueId;
    },
    [loadLeagues, onlineReady, players, profile?.username, pushToast],
  );

  const joinLeague = useCallback(
    async (inviteCode: string) => {
      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("join_league_by_code", { p_invite_code: inviteCode.trim().toUpperCase() });
        if (error) throw error;
        await loadLeagues();
        pushToast("Te has unido a la liga.", "success");
        return;
      }

      const league = leagues.find((item) => item.inviteCode === inviteCode.trim().toUpperCase());
      if (!league) throw new Error("No existe ninguna liga demo con ese código.");
      if (members.some((member) => member.leagueId === league.id && member.userId === demoUserId)) {
        throw new Error("Ya perteneces a esta liga.");
      }
      pushToast("En modo demo solo puedes unirte a ligas de esta sesión.", "info");
    },
    [leagues, loadLeagues, members, onlineReady, pushToast],
  );

  const leaveLeague = useCallback(
    async (leagueId: string) => {
      if (onlineReady && supabase) {
        const { error } = await supabase.from("league_members").delete().eq("league_id", leagueId).eq("user_id", session!.user.id);
        if (error) throw error;
        await loadLeagues();
      } else {
        setLeagues((current) => current.filter((league) => league.id !== leagueId));
      }
      pushToast("Has salido de la liga.", "success");
    },
    [loadLeagues, onlineReady, pushToast, session],
  );

  const deleteLeague = useCallback(
    async (leagueId: string) => {
      const league = leagues.find((item) => item.id === leagueId);
      if (!league || league.ownerId !== userId) throw new Error("Solo el creador puede eliminar esta liga.");

      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("delete_league", { p_league_id: leagueId });
        if (error) throw error;
        if (selectedLeagueId === leagueId) setSelectedLeagueId(null);
        await loadLeagues();
      } else {
        setLeagues((current) => current.filter((item) => item.id !== leagueId));
        setMembers((current) => current.filter((member) => member.leagueId !== leagueId));
        setLeaguePlayers((current) => current.filter((item) => item.leagueId !== leagueId));
        if (selectedLeagueId === leagueId) setSelectedLeagueId(null);
      }
      pushToast("Liga eliminada.", "success");
    },
    [leagues, loadLeagues, onlineReady, pushToast, selectedLeagueId, userId],
  );

  const updateProfile = useCallback(
    async (input: { username: string; avatarUrl?: string }) => {
      if (onlineReady && supabase && session) {
        const { error } = await supabase
          .from("profiles")
          .update({ username: input.username, avatar_url: input.avatarUrl ?? null })
          .eq("user_id", session.user.id);
        if (error) throw error;
        await ensureProfile(session);
      } else if (profile) {
        setProfile({ ...profile, username: input.username, avatarUrl: input.avatarUrl ?? profile.avatarUrl });
        setMembers((current) =>
          current.map((member) => (member.userId === demoUserId ? { ...member, username: input.username } : member)),
        );
      }
      pushToast("Perfil actualizado.", "success");
    },
    [ensureProfile, onlineReady, profile, pushToast, session],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!onlineReady || !supabase || !session) throw new Error("Necesitas iniciar sesion para subir avatar.");
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${session.user.id}/${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      return data.publicUrl;
    },
    [onlineReady, session],
  );

  const updateLeagueSettings = useCallback(
    async (patch: Partial<League> & { scoringRules?: ScoringRules }) => {
      if (!currentLeague) return;
      if (onlineReady && supabase) {
        const { error } = await supabase
          .from("leagues")
          .update({
            name: patch.name,
            initial_budget: patch.initialBudget,
            max_members: patch.maxMembers,
            market_locked: patch.marketLocked,
            lineups_locked: patch.lineupsLocked,
          })
          .eq("id", currentLeague.id);
        if (error) throw error;
        if (patch.scoringRules) {
          const { error: rulesError } = await supabase
            .from("scoring_rules")
            .upsert({ league_id: currentLeague.id, rules_json: patch.scoringRules }, { onConflict: "league_id" });
          if (rulesError) throw rulesError;
        }
        await loadLeagueData(currentLeague.id);
      } else {
        setLeagues((current) =>
          current.map((league) => (league.id === currentLeague.id ? { ...league, ...patch } : league)),
        );
        if (patch.scoringRules) setScoringRules(patch.scoringRules);
      }
      pushToast("Configuración guardada.", "success");
    },
    [currentLeague, loadLeagueData, onlineReady, pushToast],
  );

  const updatePlayerAvailability = useCallback(
    async (playerId: string, status: PlayerStatus, unavailableUntilMatchday?: number | null) => {
      if (!isOverloadAdmin) throw new Error("Solo el admin Overload puede editar lesiones y sanciones.");
      const player = players.find((item) => item.id === playerId);
      if (!player) throw new Error("Jugador no encontrado.");

      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("admin_update_player_availability", {
          p_player_id: playerId,
          p_status: status,
          p_unavailable_until_matchday: unavailableUntilMatchday ?? null,
        });
        if (error) throw error;
        if (currentLeague) await loadLeagueData(currentLeague.id);
      } else {
        setPlayers((current) =>
          current.map((item) =>
            item.id === playerId ? { ...item, status, unavailableUntilMatchday: unavailableUntilMatchday ?? null } : item,
          ),
        );
      }
      pushToast(`Estado de ${player.name} actualizado.`, "success");
    },
    [currentLeague, isOverloadAdmin, loadLeagueData, onlineReady, players, pushToast],
  );

  const advanceLeagueMatchday = useCallback(
    async (matchdayNumber: number) => {
      if (!currentLeague) return;
      if (!isOverloadAdmin) throw new Error("Solo el admin Overload puede avanzar la jornada.");
      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("admin_set_current_matchday", {
          p_league_id: currentLeague.id,
          p_matchday_number: matchdayNumber,
        });
        if (error) throw error;
        await loadLeagueData(currentLeague.id);
      } else {
        setLeagues((current) =>
          current.map((league) => (league.id === currentLeague.id ? { ...league, currentMatchday: matchdayNumber } : league)),
        );
      }
      pushToast(`Jornada actual movida a J${matchdayNumber}.`, "success");
    },
    [currentLeague, isOverloadAdmin, loadLeagueData, onlineReady, pushToast],
  );

  const buyPlayer = useCallback(
    async (playerId: string, amount?: number) => {
      if (!currentLeague || !userId) return;
      const target = leaguePlayers.find((item) => item.playerId === playerId);
      const player = players.find((item) => item.id === playerId);
      const price = amount ?? (target?.ownerUserId ? target.releaseClause : target?.price) ?? player?.currentPrice ?? 0;
<<<<<<< HEAD
=======
      const member = members.find((item) => item.userId === userId);
      const previousOwner = target?.ownerUserId ? members.find((item) => item.userId === target.ownerUserId) : undefined;
      const isClauseBuy = Boolean(target?.ownerUserId);
>>>>>>> 6bc6cc2 (Version 2.2)
      if (!player || !target) throw new Error("Jugador no encontrado.");
      if (currentLeague.marketLocked) throw new Error("El mercado está bloqueado.");
      if (target.ownerUserId === userId) throw new Error("Ese jugador ya es tuyo.");
      if (target.ownerUserId && target.clauseLockedUntil && new Date(target.clauseLockedUntil).getTime() > Date.now()) {
        throw new Error(`No se puede clausular hasta ${new Date(target.clauseLockedUntil).toLocaleDateString("es-ES")}.`);
      }

      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("buy_player", {
          p_league_id: currentLeague.id,
          p_player_id: playerId,
          p_amount: price,
        });
        if (error) throw error;
        await loadLeagueData(currentLeague.id);
<<<<<<< HEAD
=======
        await sendRemoteFantasyPush(supabase, {
          leagueId: currentLeague.id,
          userIds: [userId],
          body: `🛒 Has fichado a: ${player.name}`,
          data: { type: "transfer", playerId },
        }).catch(() => undefined);
        if (previousOwner?.userId && previousOwner.userId !== userId) {
          await sendRemoteFantasyPush(supabase, {
            leagueId: currentLeague.id,
            userIds: [previousOwner.userId],
            body: `‼️ ${member?.username ?? "Alguien"} te ha robado un jugador: ${player.name}`,
            data: { type: "clause_buy", playerId, buyerId: userId },
          }).catch(() => undefined);
        }
>>>>>>> 6bc6cc2 (Version 2.2)
        pushToast(`${player.name} fichado.`, "success");
        return;
      }

<<<<<<< HEAD
      const member = members.find((item) => item.userId === userId);
      if (!member || member.budget < price) throw new Error("No tienes presupuesto suficiente.");
      const previousOwner = target.ownerUserId ? members.find((item) => item.userId === target.ownerUserId) : undefined;
      const isClauseBuy = Boolean(target.ownerUserId);
=======
      if (!member || member.budget < price) throw new Error("No tienes presupuesto suficiente.");
>>>>>>> 6bc6cc2 (Version 2.2)
      setLeaguePlayers((current) =>
        current.map((item) =>
          item.playerId === playerId
            ? {
                ...item,
                ownerUserId: userId,
                listedByUserId: null,
                marketStatus: "owned",
                price,
                releaseClause: releaseClauseFor(price),
                clauseLockedUntil: clauseLockUntil(),
              }
            : item,
        ),
      );
<<<<<<< HEAD
=======
      setPlayers((current) => current.map((item) => (item.id === playerId ? { ...item, currentPrice: price } : item)));
>>>>>>> 6bc6cc2 (Version 2.2)
      setMembers((current) =>
        current.map((item) => {
          if (item.userId === userId) {
            return {
              ...item,
              budget: item.budget - price,
<<<<<<< HEAD
              squadValue: item.squadValue + player.currentPrice,
=======
              squadValue: item.squadValue + price,
>>>>>>> 6bc6cc2 (Version 2.2)
            };
          }
          if (item.userId === previousOwner?.userId) {
            return {
              ...item,
              budget: item.budget + price,
<<<<<<< HEAD
              squadValue: Math.max(0, item.squadValue - player.currentPrice),
=======
              squadValue: Math.max(0, item.squadValue - price),
>>>>>>> 6bc6cc2 (Version 2.2)
            };
          }
          return item;
        }),
      );
      if (previousOwner) {
        setLineups((current) =>
          current.map((lineup) =>
            lineup.userId === previousOwner.userId
              ? { ...lineup, players: lineup.players.filter((lineupPlayer) => lineupPlayer.playerId !== playerId) }
              : lineup,
          ),
        );
      }
      const transfer: Transfer = {
        id: randomId("transfer"),
        leagueId: currentLeague.id,
        userId,
        username: member.username,
        playerId,
        playerName: player.name,
        type: isClauseBuy ? "clause_buy" : "buy",
        amount: price,
        createdAt: new Date().toISOString(),
      };
      setTransfers((current) => [transfer, ...current]);
      setActivities((current) => [
        {
          id: randomId("activity"),
          leagueId: currentLeague.id,
          type: "transfer",
          message: isClauseBuy
            ? `${member.username} paga la cláusula de ${player.name} por ${formatMoney(price)}.`
            : `${member.username} ficha a ${player.name} por ${formatMoney(price)}.`,
          createdAt: transfer.createdAt,
        },
        ...current,
      ]);
      pushToast(isClauseBuy ? `${player.name} llega por cláusula.` : `${player.name} fichado.`, "success");
    },
    [currentLeague, leaguePlayers, loadLeagueData, members, onlineReady, players, pushToast, userId],
  );

  const raisePlayerClause = useCallback(
    async (playerId: string, spendAmount: number) => {
      if (!currentLeague || !userId) return;
      const target = leaguePlayers.find((item) => item.playerId === playerId);
      const player = players.find((item) => item.id === playerId);
      const cost = Number.isFinite(spendAmount) ? Math.max(50_000, Math.round(spendAmount / 50_000) * 50_000) : 0;
      const newClause = target ? target.releaseClause + clauseRaiseIncrease(cost) : 0;
      if (!player || !target || target.ownerUserId !== userId) throw new Error("Ese jugador no pertenece a tu plantilla.");
      if (newClause <= target.releaseClause) throw new Error("La nueva cláusula debe ser superior a la actual.");

      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("raise_player_clause", {
          p_league_id: currentLeague.id,
          p_player_id: playerId,
          p_spend_amount: cost,
        });
        if (error) throw error;
        await loadLeagueData(currentLeague.id);
        pushToast(`Cláusula de ${player.name} actualizada.`, "success");
        return;
      }

      const member = members.find((item) => item.userId === userId);
      if (!member || member.budget < cost) throw new Error("No tienes presupuesto suficiente para subir la cláusula.");
      setLeaguePlayers((current) => current.map((item) => (item.playerId === playerId ? { ...item, releaseClause: newClause } : item)));
      setMembers((current) =>
        current.map((item) =>
          item.userId === userId
            ? {
                ...item,
                budget: item.budget - cost,
              }
            : item,
        ),
      );
      const createdAt = new Date().toISOString();
      setTransfers((current) => [
        {
          id: randomId("transfer"),
          leagueId: currentLeague.id,
          userId,
          username: member.username,
          playerId,
          playerName: player.name,
          type: "clause_raise",
          amount: cost,
          createdAt,
        },
        ...current,
      ]);
      setActivities((current) => [
        {
          id: randomId("activity"),
          leagueId: currentLeague.id,
          type: "clause",
          message: `${member.username} sube la cláusula de ${player.name} a ${formatMoney(newClause)}.`,
          createdAt,
        },
        ...current,
      ]);
      pushToast(`Cláusula de ${player.name} actualizada.`, "success");
    },
    [currentLeague, leaguePlayers, loadLeagueData, members, onlineReady, players, pushToast, userId],
  );

  const sellPlayer = useCallback(
    async (playerId: string) => {
      if (!currentLeague || !userId) return;
      const target = leaguePlayers.find((item) => item.playerId === playerId);
      const player = players.find((item) => item.id === playerId);
      if (!player || target?.ownerUserId !== userId) throw new Error("Ese jugador no pertenece a tu plantilla.");
      const amount = Math.round((target.price * 0.5) / 50_000) * 50_000;

      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("sell_player", {
          p_league_id: currentLeague.id,
          p_player_id: playerId,
        });
        if (error) throw error;
        await loadLeagueData(currentLeague.id);
        pushToast(`${player.name} vendido rapido por ${formatMoney(amount)}.`, "success");
        return;
      }

      setLeaguePlayers((current) =>
        current.map((item) =>
          item.playerId === playerId
            ? {
                ...item,
                ownerUserId: null,
                listedByUserId: null,
                marketStatus: "locked",
                price: amount,
                releaseClause: releaseClauseFor(amount),
                clauseLockedUntil: null,
                marketListedAt: null,
                marketExpiresAt: null,
              }
            : item,
        ),
      );
      setMembers((current) =>
        current.map((item) =>
          item.userId === userId
            ? {
                ...item,
                budget: item.budget + amount,
                squadValue: Math.max(0, item.squadValue - player.currentPrice),
              }
            : item,
        ),
      );
      setMembers((current) =>
        current.map((member) =>
          member.userId === userId
            ? {
                ...member,
                squadValue: Math.max(0, member.squadValue - player.currentPrice),
              }
            : member,
        ),
      );
      setLineups((current) =>
        current.map((lineup) =>
          lineup.userId === userId
            ? { ...lineup, players: lineup.players.filter((lineupPlayer) => lineupPlayer.playerId !== playerId) }
            : lineup,
        ),
      );
      setTransfers((current) => [
        {
          id: randomId("transfer"),
          leagueId: currentLeague.id,
          userId,
          username: members.find((member) => member.userId === userId)?.username ?? "Manager",
          playerId,
          playerName: player.name,
          type: "sell",
          amount,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      pushToast(`${player.name} vendido rapido por ${formatMoney(amount)}.`, "success");
    },
    [currentLeague, leaguePlayers, loadLeagueData, members, onlineReady, players, pushToast, userId],
  );

  const listPlayerOnMarket = useCallback(
    async (playerId: string) => {
      if (!currentLeague || !userId) return;
      const target = leaguePlayers.find((item) => item.playerId === playerId);
      const player = players.find((item) => item.id === playerId);
      if (!player || target?.ownerUserId !== userId) throw new Error("Ese jugador no pertenece a tu plantilla.");
      if (currentLeague.marketLocked) throw new Error("El mercado esta bloqueado.");

      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("list_player_on_market", {
          p_league_id: currentLeague.id,
          p_player_id: playerId,
        });
        if (error) throw error;
        await loadLeagueData(currentLeague.id);
        pushToast(`${player.name} puesto en mercado durante 3 horas.`, "success");
        return;
      }

      const listedAt = new Date();
      setLeaguePlayers((current) =>
        current.map((item) =>
          item.playerId === playerId
            ? {
                ...item,
                ownerUserId: null,
                listedByUserId: userId,
                marketStatus: "market",
                marketListedAt: listedAt.toISOString(),
                marketExpiresAt: new Date(listedAt.getTime() + MARKET_DURATION_MS).toISOString(),
              }
            : item,
        ),
      );
      setLineups((current) =>
        current.map((lineup) =>
          lineup.userId === userId
            ? { ...lineup, players: lineup.players.filter((lineupPlayer) => lineupPlayer.playerId !== playerId) }
            : lineup,
        ),
      );
      setActivities((current) => [
        {
          id: randomId("activity"),
          leagueId: currentLeague.id,
          type: "market_listing",
          message: `${player.name} sale al mercado durante 3 horas.`,
          createdAt: listedAt.toISOString(),
        },
        ...current,
      ]);
      pushToast(`${player.name} puesto en mercado durante 3 horas.`, "success");
    },
    [currentLeague, leaguePlayers, loadLeagueData, onlineReady, players, pushToast, userId],
  );

  const cancelMarketListing = useCallback(
    async (playerId: string) => {
      if (!currentLeague || !userId) return;
      const target = leaguePlayers.find((item) => item.playerId === playerId);
      const player = players.find((item) => item.id === playerId);
      if (!player || target?.listedByUserId !== userId) throw new Error("Ese jugador no esta en venta por ti.");

      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("cancel_market_listing", {
          p_league_id: currentLeague.id,
          p_player_id: playerId,
        });
        if (error) throw error;
        await loadLeagueData(currentLeague.id);
        pushToast(`${player.name} vuelve a tu club.`, "success");
        return;
      }

      setLeaguePlayers((current) =>
        current.map((item) =>
          item.playerId === playerId
            ? {
                ...item,
                ownerUserId: userId,
                listedByUserId: null,
                marketStatus: "owned",
                marketListedAt: null,
                marketExpiresAt: null,
              }
            : item,
        ),
      );
      setOffers((current) =>
        current.map((offer) => (offer.playerId === playerId && offer.status === "pending" ? { ...offer, status: "rejected" } : offer)),
      );
      setMembers((current) =>
        current.map((member) =>
          member.userId === userId
            ? {
                ...member,
                squadValue: member.squadValue + player.currentPrice,
              }
            : member,
        ),
      );
      pushToast(`${player.name} vuelve a tu club.`, "success");
    },
    [currentLeague, leaguePlayers, loadLeagueData, onlineReady, players, pushToast, userId],
  );

  const refreshDailyMarket = useCallback(async () => {
    if (!currentLeague) return;

    if (onlineReady && supabase) {
      const { error } = await supabase.rpc("resolve_market_auctions", {
        p_league_id: currentLeague.id,
      });
      if (error) throw new Error(getErrorMessage(error, "No se pudo actualizar el mercado rotativo."));
      await loadLeagueData(currentLeague.id);
      return;
    }

    const resolved = resolveExpiredDailyMarket({
      leagueId: currentLeague.id,
      leaguePlayers,
      players,
      members,
      offers,
      createdAt: new Date().toISOString(),
    });

    setLeaguePlayers(resolved.leaguePlayers);
<<<<<<< HEAD
=======
    setPlayers(resolved.players);
>>>>>>> 6bc6cc2 (Version 2.2)
    setMembers(resolved.members);
    setOffers(resolved.offers);
    if (resolved.transfers.length > 0) setTransfers((current) => [...resolved.transfers, ...current]);
    if (resolved.activities.length > 0) setActivities((current) => [...resolved.activities, ...current]);
    if (resolved.rotated) {
      pushToast(
        resolved.awardedCount > 0
          ? `Mercado rotativo resuelto: ${resolved.awardedCount} fichaje${resolved.awardedCount === 1 ? "" : "s"} adjudicado${resolved.awardedCount === 1 ? "" : "s"}.`
          : `Nuevo mercado rotativo abierto con ${DAILY_MARKET_SIZE} jugadores.`,
        "success",
      );
    }
  }, [currentLeague, leaguePlayers, loadLeagueData, members, offers, onlineReady, players, pushToast]);

  const makeOffer = useCallback(
    async (playerId: string, amount: number, exchangePlayerId?: string | null) => {
      if (!currentLeague || !userId) return;
      const player = players.find((item) => item.id === playerId);
      const target = leaguePlayers.find((item) => item.playerId === playerId);
      const owner = target?.ownerUserId ?? null;
      const member = members.find((item) => item.userId === userId);
      const exchangePlayer = exchangePlayerId ? leaguePlayers.find((item) => item.playerId === exchangePlayerId) : undefined;
      const highestBid = getHighestBid(offers, playerId);
      const minimumBid = getNextBidAmount(target?.price ?? player?.currentPrice ?? 0, highestBid);

      if (!player || !target) throw new Error("Jugador no encontrado.");
      if (target.listedByUserId === userId) throw new Error("No puedes pujar por tu propio jugador.");
      if (!member || member.budget < amount) throw new Error("No tienes presupuesto suficiente para esa puja.");
      if (exchangePlayerId && exchangePlayer?.ownerUserId !== userId) throw new Error("Solo puedes ofrecer jugadores de tu plantilla.");
      if (!owner) {
        if (target.marketStatus !== "market" || !target.marketExpiresAt) throw new Error("Este jugador no está en la subasta diaria.");
        if (new Date(target.marketExpiresAt).getTime() <= Date.now()) throw new Error("La subasta ya ha terminado. Actualiza el mercado.");
        if (amount < minimumBid) throw new Error(`La puja mínima es ${formatMoney(minimumBid)}.`);
      }

      if (onlineReady && supabase) {
        const { error } = owner
          ? await supabase.from("offers").insert({
              league_id: currentLeague.id,
              from_user_id: userId,
              to_user_id: owner,
              player_id: playerId,
              amount,
              kind: exchangePlayerId ? "exchange" : "transfer",
              exchange_player_id: exchangePlayerId ?? null,
              status: "pending",
            })
          : await supabase.rpc("place_market_bid", {
              p_league_id: currentLeague.id,
              p_player_id: playerId,
              p_amount: amount,
            });
        if (error) throw error;
        await loadLeagueData(currentLeague.id);
<<<<<<< HEAD
=======
        if (owner) {
          await sendRemoteFantasyPush(supabase, {
            leagueId: currentLeague.id,
            userIds: [owner],
            body: `💰 ${member.username} te ofrece ${formatMoney(amount)} por: ${player.name}`,
            data: { type: "offer", playerId, fromUserId: userId },
          }).catch(() => undefined);
        } else if (highestBid?.fromUserId && highestBid.fromUserId !== userId) {
          await sendRemoteFantasyPush(supabase, {
            leagueId: currentLeague.id,
            userIds: [highestBid.fromUserId],
            body: `‼️ ${member.username} ha superado tu puja por: ${player.name}`,
            data: { type: "outbid", playerId, fromUserId: userId },
          }).catch(() => undefined);
        }
>>>>>>> 6bc6cc2 (Version 2.2)
      } else {
        setOffers((current) => {
          const next = current.map((offer) =>
            offer.playerId === playerId && offer.fromUserId === userId && offer.status === "pending" ? { ...offer, status: "outbid" as const } : offer,
          );
          return [
            {
              id: randomId("offer"),
              leagueId: currentLeague.id,
              fromUserId: userId,
              toUserId: owner,
              playerId,
              amount,
              kind: exchangePlayerId ? "exchange" : "transfer",
              exchangePlayerId: exchangePlayerId ?? null,
              status: "pending",
              createdAt: new Date().toISOString(),
            },
            ...next,
          ];
        });
      }
      pushToast(owner ? `Oferta enviada por ${player.name}.` : `Puja enviada por ${player.name}.`, "success");
    },
    [currentLeague, leaguePlayers, loadLeagueData, members, offers, onlineReady, players, pushToast, userId],
  );

  const acceptOffer = useCallback(
    async (offerId: string) => {
<<<<<<< HEAD
=======
      const offer = offers.find((item) => item.id === offerId);
      const player = offer ? players.find((item) => item.id === offer.playerId) : undefined;
>>>>>>> 6bc6cc2 (Version 2.2)
      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("accept_offer", { p_offer_id: offerId });
        if (error) throw error;
        if (currentLeague) await loadLeagueData(currentLeague.id);
<<<<<<< HEAD
=======
        if (currentLeague && offer?.fromUserId && player) {
          await sendRemoteFantasyPush(supabase, {
            leagueId: currentLeague.id,
            userIds: [offer.fromUserId],
            body: `🛒 Has fichado a: ${player.name}`,
            data: { type: "offer_accepted", playerId: player.id },
          }).catch(() => undefined);
        }
>>>>>>> 6bc6cc2 (Version 2.2)
      } else {
        setOffers((current) => current.map((offer) => (offer.id === offerId ? { ...offer, status: "accepted" } : offer)));
      }
      pushToast("Oferta aceptada.", "success");
    },
<<<<<<< HEAD
    [currentLeague, loadLeagueData, onlineReady, pushToast],
=======
    [currentLeague, loadLeagueData, offers, onlineReady, players, pushToast],
>>>>>>> 6bc6cc2 (Version 2.2)
  );

  const rejectOffer = useCallback(
    async (offerId: string) => {
      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("reject_offer", { p_offer_id: offerId });
        if (error) throw error;
        if (currentLeague) await loadLeagueData(currentLeague.id);
      } else {
        setOffers((current) => current.map((offer) => (offer.id === offerId ? { ...offer, status: "rejected" } : offer)));
      }
      pushToast("Oferta rechazada.", "info");
    },
    [currentLeague, loadLeagueData, onlineReady, pushToast],
  );

<<<<<<< HEAD
=======
  const cancelOffer = useCallback(
    async (offerId: string) => {
      const offer = offers.find((item) => item.id === offerId);
      if (!offer || offer.fromUserId !== userId || offer.status !== "pending") {
        throw new Error("Solo puedes eliminar pujas u ofertas tuyas que sigan pendientes.");
      }

      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("cancel_offer", { p_offer_id: offerId });
        if (error) throw error;
        if (currentLeague) await loadLeagueData(currentLeague.id);
      } else {
        setOffers((current) => current.map((item) => (item.id === offerId ? { ...item, status: "rejected" } : item)));
      }
      pushToast(offer.toUserId ? "Oferta eliminada." : "Puja eliminada.", "info");
    },
    [currentLeague, loadLeagueData, offers, onlineReady, pushToast, userId],
  );

>>>>>>> 6bc6cc2 (Version 2.2)
  const submitLineup = useCallback(
    async (formation: Formation, starterIds: string[], benchIds: string[], matchdayNumber?: number) => {
      if (!currentLeague || !userId) return;
      const requestedMatchdayNumber = matchdayNumber ?? currentLeague.currentMatchday;
      if (currentLeague.lineupsLocked && requestedMatchdayNumber <= currentLeague.currentMatchday) {
        throw new Error("Las alineaciones de esta jornada estan bloqueadas. Puedes preparar la siguiente.");
      }
      const squadPlayers = leaguePlayers
        .filter((leaguePlayer) => leaguePlayer.ownerUserId === userId)
        .map((leaguePlayer) => players.find((player) => player.id === leaguePlayer.playerId))
        .filter(Boolean) as Player[];
      const validation = validateLineup(squadPlayers, starterIds, formation, requestedMatchdayNumber);
      if (!validation.valid) throw new Error(validation.errors.join(" "));
      const targetMatchday =
        matchdays.find((matchday) => matchday.number === requestedMatchdayNumber) ??
        matchdays.find((matchday) => matchday.number === currentLeague.currentMatchday) ??
        matchdays[0];
      if (!targetMatchday && !onlineReady) throw new Error("No hay jornada activa.");

      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("submit_lineup_by_number", {
          p_league_id: currentLeague.id,
          p_matchday_number: requestedMatchdayNumber,
          p_formation: formation,
          p_starters: starterIds,
          p_bench: benchIds,
        });
        if (error) throw error;
        await loadLeagueData(currentLeague.id);
        pushToast(`Alineacion subida para J${requestedMatchdayNumber}.`, "success");
        return;
      }

      const offlineMatchday =
        targetMatchday ??
        ({
          id: randomId("matchday"),
          leagueId: currentLeague.id,
          number: requestedMatchdayNumber,
          status: "pendiente",
          startsAt: new Date().toISOString(),
          matches: [],
        } satisfies Matchday);
      const lineupPlayers: LineupPlayer[] = [
        ...starterIds.map((playerId, slot) => {
          const player = players.find((item) => item.id === playerId)!;
          return { playerId, slot, isStarter: true, position: player.position };
        }),
        ...benchIds.map((playerId, index) => {
          const player = players.find((item) => item.id === playerId)!;
          return { playerId, slot: 11 + index, isStarter: false, position: player.position };
        }),
      ];
      setLineups((current) => [
        {
          id: randomId("lineup"),
          leagueId: currentLeague.id,
          userId,
          matchdayId: offlineMatchday.id,
          formation,
          status: "submitted",
          players: lineupPlayers,
          createdAt: new Date().toISOString(),
        },
        ...current.filter(
          (lineup) =>
            !(lineup.leagueId === currentLeague.id && lineup.userId === userId && lineup.matchdayId === offlineMatchday.id),
        ),
      ]);
      setMatchdays((current) => (current.some((matchday) => matchday.id === offlineMatchday.id) ? current : [...current, offlineMatchday]));
      pushToast(`Alineacion subida para J${requestedMatchdayNumber}.`, "success");
    },
    [currentLeague, leaguePlayers, loadLeagueData, matchdays, onlineReady, players, pushToast, userId],
  );

  const requestChallengeSync = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase no esta configurado.");
    }
    if (!isOverloadAdmin) {
      throw new Error("Solo el admin Overload puede actualizar Challenge.");
    }
    const requestedAt = new Date();
    const requestId = crypto.randomUUID();
    setChallengeSyncStatus((current) => ({
      id: current?.id ?? "overload-series",
      sourceUrl: current?.sourceUrl ?? "https://challenge.place/c/68486e1155cbb0e036a0559f/stage/69de85f89e7d357d88be816c",
      status: "checking",
      message: "Solicitud enviada. Esperando respuesta del worker de Challenge.",
      snapshotHash: current?.snapshotHash,
      lastCheckedAt: current?.lastCheckedAt,
      lastChangedAt: current?.lastChangedAt,
      updatedAt: new Date().toISOString(),
    }));

    const { error } = await withSupabaseTimeout(
      supabase.from("challenge_sync_requests").insert({
        id: requestId,
        requested_by: userId ?? null,
        status: "pending",
        message: "Solicitud manual desde la app.",
      }),
      "Solicitud de Challenge",
    );
    if (error) throw new Error(getErrorMessage(error, "No se pudo pedir la actualizacion de Challenge."));
    pushToast("Actualizacion de Challenge solicitada.", "success");

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await wait(2500);

      const syncStatusRow = await fetchMaybeRow(
        supabase.from("challenge_sync_status").select("*").eq("id", "overload-series").maybeSingle(),
      ).catch(() => null);
      const latestStatus = syncStatusRow ? mapChallengeSyncStatus(syncStatusRow) : undefined;
      if (latestStatus) setChallengeSyncStatus(latestStatus);

      const isFreshStatus =
        latestStatus?.updatedAt && new Date(latestStatus.updatedAt).getTime() >= requestedAt.getTime() - 1000;
      if (isFreshStatus && latestStatus?.status === "error") {
        throw new Error(latestStatus.message || "Challenge devolvio un error al sincronizar.");
      }
      if (isFreshStatus && (latestStatus?.status === "changed" || latestStatus?.status === "ok")) {
        if (currentLeague?.id) await loadLeagueData(currentLeague.id);
        pushToast("Challenge actualizado correctamente.", "success");
        return;
      }

      if (session) {
        const requestRow = await fetchMaybeRow(
          supabase.from("challenge_sync_requests").select("status,message,processed_at").eq("id", requestId).maybeSingle(),
        ).catch(() => null);
        if (requestRow?.status === "failed") {
          throw new Error(requestRow.message ?? "El worker no pudo sincronizar Challenge.");
        }
      }
    }

    setChallengeSyncStatus((current) => ({
      id: current?.id ?? "overload-series",
      sourceUrl: current?.sourceUrl ?? "https://challenge.place/c/68486e1155cbb0e036a0559f/stage/69de85f89e7d357d88be816c",
      status: "error",
      message: "La solicitud se envio, pero no hay un worker activo respondiendo. Arranca npm run sync:challenge:watch en el servidor.",
      snapshotHash: current?.snapshotHash,
      lastCheckedAt: current?.lastCheckedAt,
      lastChangedAt: current?.lastChangedAt,
      updatedAt: new Date().toISOString(),
    }));
    throw new Error("La solicitud se envio, pero el worker de Challenge no respondio. Hay que arrancar npm run sync:challenge:watch en el servidor.");
  }, [currentLeague?.id, isOverloadAdmin, loadLeagueData, pushToast, session, userId]);

  const simulateCurrentMatchday = useCallback(async () => {
    if (!currentLeague) return;
    const currentMember = members.find((member) => member.userId === userId);
    if (currentMember?.role !== "admin") throw new Error("Solo el admin puede simular jornadas.");

    const currentMatchday = matchdays.find((matchday) => matchday.number === currentLeague.currentMatchday) ?? matchdays[0];
    if (!currentMatchday) throw new Error("No hay jornadas pendientes.");

    if (onlineReady && supabase) {
      const { error } = await supabase.rpc("simulate_matchday", {
        p_league_id: currentLeague.id,
        p_matchday_id: currentMatchday.id,
      });
      if (error) throw error;
      await loadLeagueData(currentLeague.id);
      pushToast("Jornada simulada y puntos recalculados.", "success");
      return;
    }

    const simulatedMatches = currentMatchday.matches.map((match) => {
      const homeTeam = teams.find((team) => team.id === match.homeTeamId)!;
      const awayTeam = teams.find((team) => team.id === match.awayTeamId)!;
      const simulated = simulateMatch(homeTeam, awayTeam, players, scoringRules, currentMatchday.id);
      return {
        ...simulated,
        id: match.id,
        playerStats: simulated.playerStats.map((stat) => ({ ...stat, matchId: match.id })),
      };
    });
    const matchdayStats = simulatedMatches.flatMap((match) => match.playerStats);
    const currentLineups = lineups.filter((lineup) => lineup.matchdayId === currentMatchday.id);

    setPlayers((current) =>
      current.map((player) => {
        const points = matchdayStats
          .filter((stat) => stat.playerId === player.id)
          .reduce((sum, stat) => sum + (stat.fantasyPoints ?? 0), 0);
        if (!points) return player;
        return {
          ...player,
          totalPoints: player.totalPoints + points,
          pointsByMatchday: { ...player.pointsByMatchday, [currentMatchday.number]: points },
        };
      }),
    );

    setMembers((current) =>
      current.map((member) => {
        const lineup = currentLineups.find((item) => item.userId === member.userId);
        const starterIds = lineup?.players.filter((item) => item.isStarter).map((item) => item.playerId) ?? [];
        const points = matchdayStats
          .filter((stat) => starterIds.includes(stat.playerId))
          .reduce((sum, stat) => sum + (stat.fantasyPoints ?? 0), 0);
        return {
          ...member,
          totalPoints: member.totalPoints + points,
          lastMatchdayPoints: points,
          pointsByMatchday: { ...member.pointsByMatchday, [currentMatchday.number]: points },
        };
      }),
    );

    setMatchdays((current) =>
      current.map((matchday) =>
        matchday.id === currentMatchday.id
          ? { ...matchday, status: "finalizada", matches: simulatedMatches }
          : matchday.number === currentMatchday.number + 1
            ? { ...matchday, status: "pendiente" }
            : matchday,
      ),
    );
    setLeagues((current) =>
      current.map((league) =>
        league.id === currentLeague.id
          ? { ...league, currentMatchday: Math.min(league.currentMatchday + 1, matchdays.length) }
          : league,
      ),
    );
    const topStat = [...matchdayStats].sort((a, b) => (b.fantasyPoints ?? 0) - (a.fantasyPoints ?? 0))[0];
    const topPlayer = players.find((player) => player.id === topStat?.playerId);
    setActivities((current) => [
      {
        id: randomId("activity"),
        leagueId: currentLeague.id,
        type: "matchday_simulated",
        message: `Jornada ${currentMatchday.number} simulada. ${topPlayer?.name ?? "Un jugador"} hizo ${topStat?.fantasyPoints ?? 0} puntos.`,
        createdAt: new Date().toISOString(),
      },
      ...simulatedMatches.map((match) => ({
        id: randomId("activity"),
        leagueId: currentLeague.id,
        type: "match",
        message: `${match.homeTeamName} ganó ${match.homeScore}-${match.awayScore} ante ${match.awayTeamName}.`,
        createdAt: new Date().toISOString(),
      })),
      ...current,
    ]);
    pushToast("Jornada simulada y puntos recalculados.", "success");
  }, [
    currentLeague,
    lineups,
    loadLeagueData,
    matchdays,
    members,
    onlineReady,
    players,
    pushToast,
    scoringRules,
    teams,
    userId,
  ]);

  const updateMatchResult = useCallback(
    async (match: Match) => {
      if (!currentLeague) return;
      if (onlineReady && supabase) {
        const { error } = await supabase.rpc("update_match_result", {
          p_match_id: match.id,
          p_home_score: match.homeScore,
          p_away_score: match.awayScore,
          p_player_stats: match.playerStats,
        });
        if (error) throw error;
        await loadLeagueData(currentLeague.id);
      } else {
        setMatchdays((current) =>
          current.map((matchday) => ({
            ...matchday,
            matches: matchday.matches.map((item) => (item.id === match.id ? match : item)),
          })),
        );
      }
      pushToast("Resultado actualizado.", "success");
    },
    [currentLeague, loadLeagueData, onlineReady, pushToast],
  );

  const resetDemoSeason = useCallback(() => {
    applyDemoSnapshot(buildDemoSnapshot());
    setDemoMode(true);
    pushToast("Partida demo reiniciada.", "success");
  }, [applyDemoSnapshot, pushToast]);

  const exportLeagueData = useCallback(
    () =>
      JSON.stringify(
        {
          profile,
          leagues,
          selectedLeagueId,
          members,
          leaguePlayers,
          matchdays,
          lineups,
          transfers,
<<<<<<< HEAD
=======
          budgetEvents,
>>>>>>> 6bc6cc2 (Version 2.2)
          offers,
          activities,
          scoringRules,
        },
        null,
        2,
      ),
    [
      activities,
      leaguePlayers,
      leagues,
      lineups,
      matchdays,
      members,
<<<<<<< HEAD
=======
      budgetEvents,
>>>>>>> 6bc6cc2 (Version 2.2)
      offers,
      profile,
      scoringRules,
      selectedLeagueId,
      transfers,
    ],
  );

  const importDemoData = useCallback(
    (json: string) => {
      const parsed = JSON.parse(json) as Partial<DemoSnapshot>;
      if (!parsed.leagues || !parsed.members || !parsed.leaguePlayers || !parsed.matchdays) {
        throw new Error("El JSON no parece una exportación válida.");
      }
      setDemoMode(true);
      setProfile(parsed.profile ?? buildDemoSnapshot().profile);
      setLeagues(parsed.leagues);
      setSelectedLeagueId(parsed.selectedLeagueId ?? parsed.leagues[0]?.id ?? null);
      setMembers(parsed.members);
      setLeaguePlayers(parsed.leaguePlayers);
      setMatchdays(parsed.matchdays);
      setLineups(parsed.lineups ?? []);
      setTransfers(parsed.transfers ?? []);
<<<<<<< HEAD
=======
      setBudgetEvents(parsed.budgetEvents ?? []);
>>>>>>> 6bc6cc2 (Version 2.2)
      setOffers(parsed.offers ?? []);
      setActivities(parsed.activities ?? []);
      setChallengeSyncStatus(undefined);
      setScoringRules(parsed.scoringRules ?? defaultScoringRules);
      pushToast("Datos importados en modo demo.", "success");
    },
    [pushToast],
  );

  const value = useMemo<FantasyContextValue>(
    () => ({
      session,
      profile,
      userId,
      demoMode,
      onlineReady,
      loading,
      selectedLeagueId,
      currentLeague,
      leagues,
      teams,
      players,
      leaguePlayers,
      members,
      matchdays,
      lineups,
      transfers,
<<<<<<< HEAD
=======
      budgetEvents,
>>>>>>> 6bc6cc2 (Version 2.2)
      offers,
      activities,
      challengeSyncStatus,
      scoringRules,
      standings,
      toasts,
      isOverloadAdmin,
      signIn,
      signUp,
      resetPassword,
      signOut,
      enterDemoMode: () => {
        setDemoMode(true);
        applyDemoSnapshot(buildDemoSnapshot());
      },
      dismissToast: (toastId: string) => setToasts((current) => current.filter((toast) => toast.id !== toastId)),
      selectLeague,
      createLeague,
      joinLeague,
      leaveLeague,
      deleteLeague,
      updateProfile,
      uploadAvatar,
      updateLeagueSettings,
      updatePlayerAvailability,
      advanceLeagueMatchday,
      buyPlayer,
      sellPlayer,
      listPlayerOnMarket,
      cancelMarketListing,
      raisePlayerClause,
      makeOffer,
      refreshDailyMarket,
      acceptOffer,
      rejectOffer,
<<<<<<< HEAD
=======
      cancelOffer,
>>>>>>> 6bc6cc2 (Version 2.2)
      submitLineup,
      requestChallengeSync,
      simulateCurrentMatchday,
      updateMatchResult,
      resetDemoSeason,
      exportLeagueData,
      importDemoData,
    }),
    [
      acceptOffer,
      activities,
      applyDemoSnapshot,
      buyPlayer,
      cancelMarketListing,
<<<<<<< HEAD
=======
      cancelOffer,
>>>>>>> 6bc6cc2 (Version 2.2)
      createLeague,
      currentLeague,
      deleteLeague,
      demoMode,
      exportLeagueData,
      importDemoData,
      isOverloadAdmin,
      joinLeague,
      leaveLeague,
      leaguePlayers,
      leagues,
      listPlayerOnMarket,
      lineups,
      loading,
      makeOffer,
      matchdays,
      members,
      offers,
      onlineReady,
      players,
      profile,
      challengeSyncStatus,
      raisePlayerClause,
      refreshDailyMarket,
      rejectOffer,
      requestChallengeSync,
      resetDemoSeason,
      resetPassword,
      scoringRules,
      selectLeague,
      selectedLeagueId,
      sellPlayer,
      session,
      signIn,
      signOut,
      signUp,
      simulateCurrentMatchday,
      standings,
      submitLineup,
      teams,
      toasts,
      transfers,
<<<<<<< HEAD
=======
      budgetEvents,
>>>>>>> 6bc6cc2 (Version 2.2)
      uploadAvatar,
      updatePlayerAvailability,
      updateLeagueSettings,
      advanceLeagueMatchday,
      updateMatchResult,
      updateProfile,
      userId,
    ],
  );

  return <FantasyContext.Provider value={value}>{children}</FantasyContext.Provider>;
};

export const useFantasy = () => {
  const context = useContext(FantasyContext);
  if (!context) throw new Error("useFantasy debe usarse dentro de FantasyProvider.");
  return context;
};
