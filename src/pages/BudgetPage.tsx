import { Clock3, Gavel, HandCoins, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useFantasy } from "../store/fantasyStore";
import type { ActivityItem, BudgetEvent, TransferType } from "../types";
import { formatDate, formatMoney } from "../utils/formatters";
import { formatTimeLeft, getHighestBid } from "../utils/market";

type BudgetLogRow = {
  id: string;
  createdAt: string;
  title: string;
  detail: string;
  delta: number;
};

const spendTypes = new Set<TransferType>(["buy", "clause_buy", "auction_win", "offer_accepted", "clause_raise", "offer"]);
const incomeTypes = new Set<TransferType>(["sell", "league_offer"]);

const metadataValue = (activity: ActivityItem, key: string) => activity.metadata?.[key];

const metadataText = (activity: ActivityItem, key: string) => {
  const value = metadataValue(activity, key);
  return typeof value === "string" ? value : null;
};

const metadataNumber = (activity: ActivityItem, key: string) => {
  const value = metadataValue(activity, key);
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const transferTitle: Record<TransferType, string> = {
  buy: "Fichaje",
  sell: "Venta rapida",
  offer: "Oferta enviada",
  offer_accepted: "Oferta aceptada",
  clause_buy: "Clausula pagada",
  clause_raise: "Subida de clausula",
  auction_win: "Subasta ganada",
  league_offer: "Venta a la liga",
};

export const BudgetPage = () => {
  const { currentLeague, userId, members, players, leaguePlayers, offers, transfers, budgetEvents, activities, cancelOffer } = useFantasy();
  const [error, setError] = useState("");
  const me = members.find((member) => member.userId === userId);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.userId, member])), [members]);

  const pendingSentOffers = offers.filter((offer) => offer.fromUserId === userId && offer.status === "pending");
  const committedAmount = pendingSentOffers.reduce((sum, offer) => sum + offer.amount, 0);
  const projectedBudget = (me?.budget ?? 0) - committedAmount;

  const runAction = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la accion.");
    }
  };

  const myMarketBids = useMemo(() => {
    const grouped = new Map<string, typeof offers>();
    offers
      .filter((offer) => offer.fromUserId === userId)
      .forEach((offer) => grouped.set(offer.playerId, [...(grouped.get(offer.playerId) ?? []), offer]));

    return [...grouped.entries()]
      .map(([playerId, playerOffers]) => {
        const leaguePlayer = leaguePlayers.find((item) => item.playerId === playerId);
        if (!leaguePlayer || leaguePlayer.ownerUserId || leaguePlayer.marketStatus !== "market") return null;
        const player = playerById.get(playerId);
        const highestBid = getHighestBid(offers, playerId);
        const ownBest = [...playerOffers].sort((a, b) => b.amount - a.amount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const latest = [...playerOffers].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const status = highestBid?.fromUserId === userId ? "Lideras" : latest.status === "outbid" ? "Superada" : latest.status;
        return { player, leaguePlayer, highestBid, ownBest, latest, status };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.latest.createdAt).getTime() - new Date(a!.latest.createdAt).getTime());
  }, [leaguePlayers, offers, playerById, userId]);

  const directOffers = offers
    .filter((offer) => offer.fromUserId === userId && Boolean(offer.toUserId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const budgetLog = useMemo(() => {
    const rows: BudgetLogRow[] = budgetEvents
      .filter((event: BudgetEvent) => event.leagueId === currentLeague?.id && event.userId === userId)
      .map((event) => ({
        id: `budget-${event.id}`,
        createdAt: event.createdAt,
        title: event.matchdayNumber ? `Bonus jornada ${event.matchdayNumber}` : "Bonus de presupuesto",
        detail: event.description,
        delta: event.amount,
      }));

    transfers
      .filter((transfer) => transfer.leagueId === currentLeague?.id && transfer.userId === userId)
      .forEach((transfer) => {
        const delta = incomeTypes.has(transfer.type) ? transfer.amount : spendTypes.has(transfer.type) ? -transfer.amount : -transfer.amount;
        rows.push({
          id: `transfer-${transfer.id}`,
          createdAt: transfer.createdAt,
          title: transferTitle[transfer.type] ?? "Movimiento",
          detail: transfer.playerName,
          delta,
        });
      });

    offers
      .filter((offer) => offer.toUserId === userId && offer.status === "accepted")
      .forEach((offer) => {
        rows.push({
          id: `offer-income-${offer.id}`,
          createdAt: offer.createdAt,
          title: "Oferta cobrada",
          detail: playerById.get(offer.playerId)?.name ?? "Jugador",
          delta: offer.amount,
        });
      });

    activities
      .filter((activity) => activity.leagueId === currentLeague?.id)
      .forEach((activity) => {
        const playerId = metadataText(activity, "player_id");
        const playerName = playerId ? playerById.get(playerId)?.name : undefined;
        const amount = metadataNumber(activity, "amount");
        const buyerId = metadataText(activity, "user_id");
        const buyerName = buyerId ? memberById.get(buyerId)?.username : undefined;

        if (metadataText(activity, "previous_owner") === userId && amount > 0) {
          rows.push({
            id: `activity-clause-${activity.id}`,
            createdAt: activity.createdAt,
            title: "Clausula cobrada",
            detail: `${playerName ?? "Jugador"}${buyerName ? ` a ${buyerName}` : ""}`,
            delta: amount,
          });
        }

        if (metadataText(activity, "seller_id") === userId && amount > 0) {
          rows.push({
            id: `activity-auction-${activity.id}`,
            createdAt: activity.createdAt,
            title: "Venta en subasta",
            detail: `${playerName ?? "Jugador"}${buyerName ? ` a ${buyerName}` : ""}`,
            delta: amount,
          });
        }
      });

    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 40);
  }, [activities, budgetEvents, currentLeague?.id, memberById, offers, playerById, transfers, userId]);

  if (!me) {
    return <EmptyState title="Presupuesto no disponible" description="Entra en una liga para ver tu caja y tus movimientos." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Presupuesto</h1>
        <p className="mt-1 text-sm text-slate-400">{currentLeague?.name ?? "Liga"} - caja, pujas y movimientos</p>
      </div>
      {error ? <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase text-slate-400">Caja actual</div>
              <div className="mt-1 text-2xl font-black text-white">{formatMoney(me.budget)}</div>
            </div>
            <Wallet className="h-6 w-6 text-[#62d7ff]" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase text-slate-400">Comprometido</div>
              <div className="mt-1 text-2xl font-black text-[#f5bd43]">{formatMoney(committedAmount)}</div>
            </div>
            <Clock3 className="h-6 w-6 text-[#f5bd43]" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase text-slate-400">Caja si ganas</div>
              <div className={`mt-1 text-2xl font-black ${projectedBudget < 0 ? "text-rose-200" : "text-[#21d17f]"}`}>
                {formatMoney(Math.max(projectedBudget, 0))}
              </div>
            </div>
            {projectedBudget < 0 ? <TrendingDown className="h-6 w-6 text-rose-300" /> : <TrendingUp className="h-6 w-6 text-[#21d17f]" />}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_.95fr]">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Gavel className="h-5 w-5 text-[#62d7ff]" />
            <h2 className="text-base font-black text-white">Mis pujas de mercado</h2>
          </div>
          <div className="space-y-2">
            {myMarketBids.map((row) => (
              <div key={row!.latest.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{row!.player?.name ?? "Jugador"}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-400">
                      Tu mejor puja {formatMoney(row!.ownBest.amount)} - lider {formatMoney(row!.highestBid?.amount ?? row!.leaguePlayer.price)}
                    </div>
                  </div>
                  <Badge className={row!.status === "Lideras" ? "bg-[#21d17f]/20 text-[#a9ffd4] ring-[#21d17f]/35" : "bg-[#f5bd43]/20 text-[#ffe0a2] ring-[#f5bd43]/35"}>
                    {row!.status}
                  </Badge>
                </div>
                <div className="mt-2 text-xs font-bold text-slate-400">Cierra en {formatTimeLeft(row!.leaguePlayer.marketExpiresAt)}</div>
                {row!.latest.status === "pending" ? (
                  <button
                    className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 text-xs font-black text-rose-100"
                    onClick={() => void runAction(() => cancelOffer(row!.latest.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar puja
                  </button>
                ) : null}
              </div>
            ))}
            {myMarketBids.length === 0 ? <p className="text-sm text-slate-400">No tienes pujas activas en el mercado.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-[#f5bd43]" />
            <h2 className="text-base font-black text-white">Ofertas enviadas</h2>
          </div>
          <div className="space-y-2">
            {directOffers.slice(0, 8).map((offer) => {
              const player = playerById.get(offer.playerId);
              const receiver = offer.toUserId ? memberById.get(offer.toUserId) : undefined;
              return (
                <div key={offer.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{player?.name ?? "Jugador"}</div>
                    <div className="text-xs font-semibold text-slate-400">{receiver?.username ?? "Manager"} - {offer.status}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-sm font-black text-[#f5bd43]">{formatMoney(offer.amount)}</div>
                    {offer.status === "pending" ? (
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-300/25 bg-rose-500/10 text-rose-100"
                        aria-label="Eliminar oferta"
                        onClick={() => void runAction(() => cancelOffer(offer.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {directOffers.length === 0 ? <p className="text-sm text-slate-400">No tienes ofertas directas enviadas.</p> : null}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-base font-black text-white">Log de presupuesto</h2>
        <div className="space-y-2">
          {budgetLog.map((row) => (
            <div key={row.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-white">{row.title}</div>
                <div className="truncate text-xs font-semibold text-slate-400">
                  {row.detail} - {formatDate(row.createdAt)}
                </div>
              </div>
              <div className={`text-right text-sm font-black ${row.delta >= 0 ? "text-[#21d17f]" : "text-rose-200"}`}>
                {row.delta >= 0 ? "+" : "-"}{formatMoney(Math.abs(row.delta))}
              </div>
            </div>
          ))}
          {budgetLog.length === 0 ? <p className="text-sm text-slate-400">Todavia no hay movimientos de presupuesto.</p> : null}
        </div>
      </Card>
    </div>
  );
};
