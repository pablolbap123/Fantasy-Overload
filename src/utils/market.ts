import type { ActivityItem, LeagueMember, LeaguePlayer, Offer, Player, Transfer } from "../types";
import { calculateSquadValue } from "./calculatePoints";
import { formatMoney } from "./formatters";

export const DAILY_MARKET_SIZE = 15;
export const MARKET_DURATION_MS = 5 * 60 * 60 * 1000;
export const MIN_BID_INCREMENT = 50_000;

export const roundBidAmount = (amount: number) => Math.ceil(amount / MIN_BID_INCREMENT) * MIN_BID_INCREMENT;

export const getHighestBid = (offers: Offer[], playerId: string) =>
  offers
    .filter((offer) => offer.playerId === playerId && offer.status === "pending")
    .sort((a, b) => b.amount - a.amount || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

export const getNextBidAmount = (basePrice: number, highestBid?: Offer) => {
  const currentAmount = Math.max(basePrice, highestBid?.amount ?? 0);
  return roundBidAmount(currentAmount * 1.05);
};

export const getMinimumBidAmount = (basePrice: number, highestBid?: Offer) => roundBidAmount(Math.max(basePrice, highestBid?.amount ?? 0));

export const formatTimeLeft = (expiresAt?: string | null) => {
  if (!expiresAt) return "Sin cierre";
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
};

const stableHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const marketWindowSeed = (date: Date) => {
  return String(Math.floor(date.getTime() / MARKET_DURATION_MS));
};

export const isBagPlayer = (player?: Player | null) =>
  Boolean(player && (player.teamName.toLowerCase().includes("bolsa") || player.teamId.toLowerCase() === "team-blsa"));

const isMarketEligiblePlayer = (player?: Player | null) => Boolean(player && !isBagPlayer(player));

export const openDailyMarketCycle = (
  leaguePlayers: LeaguePlayer[],
  players: Player[],
  now = new Date(),
  excludePlayerIds: string[] = [],
) => {
  const listedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + MARKET_DURATION_MS).toISOString();
  const hashSeed = marketWindowSeed(now);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const excluded = new Set(excludePlayerIds);
  const available = leaguePlayers
    .filter((item) => {
      const player = playerById.get(item.playerId);
      return !item.ownerUserId && !item.listedByUserId && !excluded.has(item.playerId) && isMarketEligiblePlayer(player);
    })
    .sort((a, b) => {
      const aPlayer = playerById.get(a.playerId);
      const bPlayer = playerById.get(b.playerId);
      return (
        stableHash(`${hashSeed}-${a.playerId}`) - stableHash(`${hashSeed}-${b.playerId}`) ||
        (bPlayer?.currentPrice ?? 0) - (aPlayer?.currentPrice ?? 0)
      );
    })
    .slice(0, DAILY_MARKET_SIZE);
  const activeIds = new Set(available.map((item) => item.playerId));

  return leaguePlayers.map((item) => {
    if (item.ownerUserId || item.listedByUserId) return item;
    if (!isMarketEligiblePlayer(playerById.get(item.playerId))) {
      return {
        ...item,
        marketStatus: "locked" as const,
        marketListedAt: null,
        marketExpiresAt: null,
      };
    }
    if (activeIds.has(item.playerId)) {
      return {
        ...item,
        marketStatus: "market" as const,
        marketListedAt: listedAt,
        marketExpiresAt: expiresAt,
      };
    }
    return {
      ...item,
      marketStatus: "locked" as const,
      marketListedAt: null,
      marketExpiresAt: null,
    };
  });
};

export const normalizeDailyMarket = (leaguePlayers: LeaguePlayer[], players: Player[]) => {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const active = leaguePlayers.filter(
    (item) =>
      !item.ownerUserId &&
      !item.listedByUserId &&
      isMarketEligiblePlayer(playerById.get(item.playerId)) &&
      item.marketStatus === "market" &&
      item.marketExpiresAt &&
      new Date(item.marketExpiresAt).getTime() > Date.now(),
  );
  if (active.length >= DAILY_MARKET_SIZE) return leaguePlayers;
  return openDailyMarketCycle(leaguePlayers, players);
};

interface ResolveDailyMarketInput {
  leagueId: string;
  leaguePlayers: LeaguePlayer[];
  players: Player[];
  members: LeagueMember[];
  offers: Offer[];
  createdAt: string;
}

export const resolveExpiredDailyMarket = ({ leagueId, leaguePlayers, players, members, offers, createdAt }: ResolveDailyMarketInput) => {
  const now = Date.now();
  const expired = leaguePlayers.filter(
    (item) =>
      (!item.ownerUserId || Boolean(item.listedByUserId)) &&
      item.marketStatus === "market" &&
      item.marketExpiresAt &&
      new Date(item.marketExpiresAt).getTime() <= now,
  );

  if (expired.length === 0) {
    return {
      leaguePlayers: normalizeDailyMarket(leaguePlayers, players),
      players,
      members,
      offers,
      transfers: [] as Transfer[],
      activities: [] as ActivityItem[],
      awardedCount: 0,
      rotated: false,
    };
  }

  const playerById = new Map(players.map((player) => [player.id, player]));
  let nextLeaguePlayers = [...leaguePlayers];
  let nextPlayers = [...players];
  let nextMembers = [...members];
  let nextOffers = [...offers];
  const transfers: Transfer[] = [];
  const activities: ActivityItem[] = [];
  const expiredIds = expired.map((item) => item.playerId);

  expired.forEach((marketPlayer) => {
    const player = playerById.get(marketPlayer.playerId);
    const bids = nextOffers
      .filter((offer) => offer.playerId === marketPlayer.playerId && offer.status === "pending")
      .sort((a, b) => b.amount - a.amount || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const winningBid = bids.find((bid) => {
      const bidder = nextMembers.find((member) => member.userId === bid.fromUserId);
      return Boolean(bidder && bidder.budget >= bid.amount);
    });

    if (!winningBid || !player) {
      const seller = marketPlayer.listedByUserId ? nextMembers.find((member) => member.userId === marketPlayer.listedByUserId) : undefined;
      if (seller && player) {
        const leagueOfferAmount = roundBidAmount(marketPlayer.price * (0.5 + (stableHash(`${createdAt}-${marketPlayer.playerId}`) % 35) / 100));
        nextMembers = nextMembers.map((member) =>
          member.userId === seller.userId
            ? {
                ...member,
                budget: member.budget + leagueOfferAmount,
                squadValue: Math.max(0, member.squadValue - calculateSquadValue([player])),
              }
            : member,
        );
        nextLeaguePlayers = nextLeaguePlayers.map((item) =>
          item.playerId === marketPlayer.playerId
            ? {
                ...item,
                ownerUserId: null,
                listedByUserId: null,
                marketStatus: "locked",
                price: leagueOfferAmount,
                releaseClause: roundBidAmount(leagueOfferAmount * 1.2),
                clauseLockedUntil: null,
                marketListedAt: null,
                marketExpiresAt: null,
              }
            : item,
        );
        nextPlayers = nextPlayers.map((item) => (item.id === player.id ? { ...item, currentPrice: leagueOfferAmount } : item));
        nextOffers = nextOffers.map((offer) =>
          offer.playerId === marketPlayer.playerId && offer.status === "pending" ? { ...offer, status: "rejected" } : offer,
        );
        transfers.push({
          id: `transfer-${crypto.randomUUID()}`,
          leagueId,
          userId: seller.userId,
          username: seller.username,
          playerId: player.id,
          playerName: player.name,
          type: "league_offer",
          amount: leagueOfferAmount,
          createdAt,
        });
        activities.push({
          id: `activity-${crypto.randomUUID()}`,
          leagueId,
          type: "league_offer",
          message: `La liga compra a ${player.name} por ${formatMoney(leagueOfferAmount)} al no recibir pujas.`,
          createdAt,
        });
        return;
      }

      nextOffers = nextOffers.map((offer) => (offer.playerId === marketPlayer.playerId && offer.status === "pending" ? { ...offer, status: "rejected" } : offer));
      nextLeaguePlayers = nextLeaguePlayers.map((item) =>
        item.playerId === marketPlayer.playerId ? { ...item, listedByUserId: null, marketStatus: "locked", marketListedAt: null, marketExpiresAt: null } : item,
      );
      return;
    }

    const winner = nextMembers.find((member) => member.userId === winningBid.fromUserId);
    if (!winner) return;
    const seller = marketPlayer.listedByUserId ? nextMembers.find((member) => member.userId === marketPlayer.listedByUserId) : undefined;

    nextMembers = nextMembers.map((member) =>
      member.userId === winningBid.fromUserId
        ? {
            ...member,
            budget: member.budget - winningBid.amount,
            squadValue: member.squadValue + calculateSquadValue([player]),
          }
        : member.userId === seller?.userId
          ? {
              ...member,
              budget: member.budget + winningBid.amount,
              squadValue: Math.max(0, member.squadValue - calculateSquadValue([player])),
            }
          : member,
    );
    nextLeaguePlayers = nextLeaguePlayers.map((item) =>
      item.playerId === marketPlayer.playerId
        ? {
            ...item,
            ownerUserId: winningBid.fromUserId,
            listedByUserId: null,
            marketStatus: "owned",
            price: winningBid.amount,
            releaseClause: roundBidAmount(winningBid.amount * 1.2),
            clauseLockedUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            marketListedAt: null,
            marketExpiresAt: null,
          }
        : item,
    );
    nextPlayers = nextPlayers.map((item) => (item.id === player.id ? { ...item, currentPrice: winningBid.amount } : item));
    nextOffers = nextOffers.map((offer) => {
      if (offer.playerId !== marketPlayer.playerId || offer.status !== "pending") return offer;
      return { ...offer, status: offer.id === winningBid.id ? ("accepted" as const) : ("outbid" as const) };
    });

    transfers.push({
      id: `transfer-${crypto.randomUUID()}`,
      leagueId,
      userId: winningBid.fromUserId,
      username: winner.username,
      playerId: player.id,
      playerName: player.name,
      type: "auction_win",
      amount: winningBid.amount,
      createdAt,
    });
    activities.push({
      id: `activity-${crypto.randomUUID()}`,
      leagueId,
      type: "auction",
      message: `${winner.username} gana la subasta de ${player.name} por ${formatMoney(winningBid.amount)}.`,
      createdAt,
    });
  });

  const activeAfterSettlement = nextLeaguePlayers.filter(
    (item) =>
      !item.ownerUserId &&
      !item.listedByUserId &&
      !isBagPlayer(playerById.get(item.playerId)) &&
      item.marketStatus === "market" &&
      item.marketExpiresAt &&
      new Date(item.marketExpiresAt).getTime() > now,
  );

  if (activeAfterSettlement.length < DAILY_MARKET_SIZE) {
    nextLeaguePlayers = openDailyMarketCycle(nextLeaguePlayers, nextPlayers, new Date(createdAt), expiredIds);
  }

  return {
    leaguePlayers: nextLeaguePlayers,
    players: nextPlayers,
    members: nextMembers,
    offers: nextOffers,
    transfers,
    activities,
    awardedCount: transfers.length,
    rotated: true,
  };
};
