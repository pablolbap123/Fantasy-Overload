import { BellRing, Clock3, Gavel, Lock, RefreshCw, Sparkles, Trash2, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MarketFilters, marketFilterOptions } from "../components/market/MarketFilters";
import { PlayerCard } from "../components/players/PlayerCard";
import { PlayerDetailDrawer } from "../components/players/PlayerDetailDrawer";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useFantasy } from "../store/fantasyStore";
import type { Player } from "../types";
import { getErrorMessage } from "../utils/errors";
import { formatMoney } from "../utils/formatters";
import { DAILY_MARKET_SIZE, formatTimeLeft, getHighestBid, getMinimumBidAmount } from "../utils/market";

const readDismissedOutbidIds = (key: string) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const writeDismissedOutbidIds = (key: string, ids: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    // Local preference only. If storage is unavailable the alert can safely reappear.
  }
};

export const MarketPage = () => {
  const {
    currentLeague,
    userId,
    players,
    leaguePlayers,
    teams,
    members,
    sellPlayer,
    makeOffer,
    refreshDailyMarket,
    transfers,
    offers,
    acceptOffer,
    rejectOffer,
    cancelOffer,
  } = useFantasy();
  const [position, setPosition] = useState<(typeof marketFilterOptions.positions)[number]>("todos");
  const [status, setStatus] = useState<(typeof marketFilterOptions.statuses)[number]>("todos");
  const [teamId, setTeamId] = useState("todos");
  const [sortBy, setSortBy] = useState("points");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | undefined>();
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const dismissedOutbidStorageKey = `fantasy_dismissed_outbids:${currentLeague?.id ?? "no-league"}:${userId ?? "guest"}`;
  const [dismissedOutbids, setDismissedOutbids] = useState(() => ({
    key: dismissedOutbidStorageKey,
    ids: readDismissedOutbidIds(dismissedOutbidStorageKey),
  }));
  const dismissedOutbidIds = dismissedOutbids.key === dismissedOutbidStorageKey ? dismissedOutbids.ids : [];

  const me = members.find((member) => member.userId === userId);
  const ownerNameByUser = new Map(members.map((member) => [member.userId, member.username]));
  const bagTeamIds = useMemo(
    () =>
      new Set(
        teams
          .filter((team) => team.shortName.toUpperCase() === "BLSA" || team.name.toLowerCase().includes("bolsa"))
          .map((team) => team.id),
      ),
    [teams],
  );
  const marketTeams = useMemo(() => teams.filter((team) => !bagTeamIds.has(team.id)), [bagTeamIds, teams]);

  const runAction = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(getErrorMessage(err, "Operacion no completada."));
    }
  };

  useEffect(() => {
    let mounted = true;
    void refreshDailyMarket().catch((err) => {
      if (mounted) setError(getErrorMessage(err, "No se pudo actualizar el mercado rotativo."));
    });
    const interval = window.setInterval(() => {
      setNow(Date.now());
      void refreshDailyMarket().catch((err) => {
        if (mounted) setError(getErrorMessage(err, "No se pudo actualizar el mercado rotativo."));
      });
    }, 60_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [refreshDailyMarket]);

  useEffect(() => {
    setDismissedOutbids({ key: dismissedOutbidStorageKey, ids: readDismissedOutbidIds(dismissedOutbidStorageKey) });
  }, [dismissedOutbidStorageKey]);

  useEffect(() => {
    if (teamId !== "todos" && bagTeamIds.has(teamId)) setTeamId("todos");
  }, [bagTeamIds, teamId]);

  const rows = useMemo(() => {
    const mappedRows = leaguePlayers
      .map((leaguePlayer) => {
        const player = players.find((item) => item.id === leaguePlayer.playerId);
        return player ? { player, leaguePlayer } : null;
      })
      .filter(Boolean)
      .filter((row) => {
        const player = row!.player;
        const leaguePlayer = row!.leaguePlayer;
        const isManagerListing = Boolean(leaguePlayer.listedByUserId);
        const isActiveAuction =
          (!leaguePlayer.ownerUserId || isManagerListing) &&
          leaguePlayer.marketStatus === "market" &&
          Boolean(leaguePlayer.marketExpiresAt) &&
          new Date(leaguePlayer.marketExpiresAt ?? "").getTime() > now;
        return (
          isActiveAuction &&
          !bagTeamIds.has(player.teamId) &&
          (position === "todos" || player.position === position || player.positions?.includes(position)) &&
          (status === "todos" || player.status === status) &&
          (teamId === "todos" || player.teamId === teamId)
        );
      })
      .sort((a, b) => {
        const aBid = getHighestBid(offers, a!.player.id);
        const bBid = getHighestBid(offers, b!.player.id);
        const aPrice = Math.max(a!.leaguePlayer.price, aBid?.amount ?? 0);
        const bPrice = Math.max(b!.leaguePlayer.price, bBid?.amount ?? 0);
        if (sortBy === "price") return bPrice - aPrice;
        if (sortBy === "name") return a!.player.name.localeCompare(b!.player.name);
        return b!.player.totalPoints - a!.player.totalPoints;
      });

    return {
      daily: mappedRows.filter((row) => !row!.leaguePlayer.listedByUserId).slice(0, DAILY_MARKET_SIZE),
      listed: mappedRows.filter((row) => Boolean(row!.leaguePlayer.listedByUserId)),
    };
  }, [bagTeamIds, leaguePlayers, now, offers, players, position, sortBy, status, teamId]);

  const activeMarketCount = rows.daily.length;
  const firstExpiration = rows.daily[0]?.leaguePlayer.marketExpiresAt;
  const pendingOffers = offers.filter((offer) => offer.status === "pending");
  const receivedOffers = pendingOffers.filter((offer) => offer.toUserId === userId);
  const sentOffers = offers.filter((offer) => offer.fromUserId === userId);
  const outbidOffers = sentOffers.filter((offer) => offer.status === "outbid" && !dismissedOutbidIds.includes(offer.id));

  const dismissOutbidAlerts = () => {
    const ids = Array.from(new Set([...dismissedOutbidIds, ...outbidOffers.map((offer) => offer.id)]));
    setDismissedOutbids({ key: dismissedOutbidStorageKey, ids });
    writeDismissedOutbidIds(dismissedOutbidStorageKey, ids);
  };

  const renderPlayerAuction = (row: NonNullable<(typeof rows.daily)[number]>, sellerLabel?: string) => {
    const leaguePlayer = row.leaguePlayer;
    const player = row.player;
    const playerOffers = pendingOffers.filter((offer) => offer.playerId === player.id);
    const highestBid = getHighestBid(offers, player.id);
    const minimumBid = getMinimumBidAmount(leaguePlayer.price, highestBid);
    const typedBid = Number(bidAmounts[player.id]);
    const bidAmount = Number.isFinite(typedBid) && typedBid > 0 ? typedBid : minimumBid;
    const leader = highestBid ? members.find((member) => member.userId === highestBid.fromUserId) : undefined;
    return (
      <PlayerCard
        key={leaguePlayer.id}
        player={player}
        price={Math.max(leaguePlayer.price, highestBid?.amount ?? 0)}
        highestBid={highestBid?.amount}
        bidCount={playerOffers.length}
        marketTimeLeft={formatTimeLeft(leaguePlayer.marketExpiresAt)}
        bidInputValue={bidAmounts[player.id] ?? ""}
        bidMinimum={minimumBid}
        ownerLabel={leader ? `Lider actual: ${leader.username}` : (sellerLabel ?? "Sin pujas todavia")}
        action="bid"
        onBid={() => void runAction(() => makeOffer(player.id, bidAmount))}
        onBidInputChange={(value) => setBidAmounts((current) => ({ ...current, [player.id]: value }))}
        onSell={() => {
          if (window.confirm(`Vender rapido a ${player.name} por la mitad de su precio?`)) void runAction(() => sellPlayer(player.id));
        }}
        onDetail={() => setSelectedPlayer(player)}
      />
    );
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-lg border border-[#62d7ff]/20 bg-[#111a23] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 bg-[linear-gradient(135deg,#1b2f46_0%,#13212f_45%,#2b2135_100%)] p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-[#f5bd43]/30 bg-[#f5bd43]/15 px-3 py-1 text-xs font-black uppercase text-[#ffe3a4]">
                <Sparkles className="h-3.5 w-3.5" />
                Subasta online
              </div>
              <h1 className="text-3xl font-black leading-tight text-white">Mercado rotativo</h1>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-300">
                15 jugadores con club cada 5 horas. Puja libre, gana la oferta mas alta al cierre.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sky-400/15 text-sky-100 ring-sky-300/25">
                <Clock3 className="mr-1 h-3 w-3" /> {firstExpiration ? formatTimeLeft(firstExpiration) : "Abriendo mercado"}
              </Badge>
              <button
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/12 bg-white/10 px-3 text-sm font-black text-white shadow-lg shadow-black/15 hover:bg-white/15"
                onClick={() => void runAction(refreshDailyMarket)}
              >
                <RefreshCw className="h-4 w-4" />
                Actualizar
              </button>
              {currentLeague?.marketLocked ? (
                <Badge className="bg-amber-400/15 text-amber-100 ring-amber-300/25">
                  <Lock className="mr-1 h-3 w-3" /> Mercado bloqueado
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-3">
          <div className="bg-[#101923] p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
              <WalletCards className="h-4 w-4 text-[#23c979]" />
              Presupuesto
            </div>
            <div className="mt-1 text-xl font-black text-white">{formatMoney(me?.budget ?? 0)}</div>
          </div>
          <div className="bg-[#101923] p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
              <Gavel className="h-4 w-4 text-[#f5bd43]" />
              Jugadores activos
            </div>
            <div className="mt-1 text-xl font-black text-white">
              {activeMarketCount}/{DAILY_MARKET_SIZE}
            </div>
          </div>
          <div className="bg-[#101923] p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
              <Clock3 className="h-4 w-4 text-[#62d7ff]" />
              Proximo cierre
            </div>
            <div className="mt-1 text-xl font-black text-white">{firstExpiration ? formatTimeLeft(firstExpiration) : "--"}</div>
          </div>
        </div>
      </div>

      <div>
        <MarketFilters
          position={position}
          status={status}
          teamId={teamId}
          sortBy={sortBy}
          teams={marketTeams}
          onPositionChange={setPosition}
          onStatusChange={setStatus}
          onTeamChange={setTeamId}
          onSortChange={setSortBy}
        />
        {error ? <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
      </div>

      {outbidOffers.length > 0 ? (
        <div className="rounded-lg border border-[#f5bd43]/35 bg-[#f5bd43]/15 p-3 shadow-lg shadow-[#f5bd43]/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <BellRing className="mt-0.5 h-5 w-5 text-[#f5bd43]" />
              <div>
                <div className="font-black text-white">Te han superado {outbidOffers.length} puja{outbidOffers.length === 1 ? "" : "s"}</div>
                <p className="text-sm text-[#ffe2a2]">La alerta queda silenciada en este dispositivo cuando pulses entendido.</p>
              </div>
            </div>
            <button className="rounded-lg border border-[#f5bd43]/30 px-3 py-2 text-sm font-black text-[#ffe2a2]" onClick={dismissOutbidAlerts}>
              Entendido
            </button>
          </div>
        </div>
      ) : null}

      {rows.daily.length === 0 ? (
        <EmptyState
          title="Mercado rotativo vacio"
          description="No hay jugadores de club activos con esos filtros. Actualiza el mercado o espera a la siguiente ventana de 5 horas."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.daily.map((row) => renderPlayerAuction(row!))}</div>
      )}

      {rows.listed.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-black text-white">Puestos por managers</h2>
            <p className="text-sm text-slate-400">Tambien cierran cada 5 horas. Si no hay pujas, la liga ofrece una cantidad automatica.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.listed.map((row) => {
              const seller = members.find((member) => member.userId === row!.leaguePlayer.listedByUserId);
              return renderPlayerAuction(row!, `Vende: ${seller?.username ?? "Manager"}`);
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {receivedOffers.length > 0 ? (
          <Card className="lg:col-span-2">
            <h2 className="mb-3 text-base font-black text-white">Ofertas recibidas</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {receivedOffers.map((offer) => {
                const player = players.find((item) => item.id === offer.playerId);
                const bidder = ownerNameByUser.get(offer.fromUserId) ?? "Manager";
                const exchangePlayer = offer.exchangePlayerId ? players.find((item) => item.id === offer.exchangePlayerId) : undefined;
                return (
                  <div key={offer.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                    <div className="text-sm font-black text-white">{player?.name ?? "Jugador"}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-400">
                      {bidder} ofrece {formatMoney(offer.amount)}
                      {exchangePlayer ? ` + ${exchangePlayer.name}` : ""}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="min-h-9 flex-1 rounded-lg bg-emerald-400 px-3 text-sm font-black text-slate-950" onClick={() => void runAction(() => acceptOffer(offer.id))}>
                        Aceptar
                      </button>
                      <button className="min-h-9 flex-1 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-black text-white" onClick={() => void runAction(() => rejectOffer(offer.id))}>
                        Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}
        <Card>
          <h2 className="mb-3 text-base font-black text-white">Historial de fichajes</h2>
          <div className="space-y-2">
            {transfers.slice(0, 8).map((transfer) => (
              <div key={transfer.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{transfer.playerName}</div>
                  <div className="text-xs text-slate-500">
                    {transfer.username} - {transfer.type}
                  </div>
                </div>
                <div className="text-sm font-black text-sky-200">{formatMoney(transfer.amount)}</div>
              </div>
            ))}
            {transfers.length === 0 ? <p className="text-sm text-slate-400">Todavia no hay movimientos en esta liga.</p> : null}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-black text-white">Mis pujas y ofertas</h2>
          <div className="space-y-2">
            {sentOffers.slice(0, 10).map((offer) => {
              const player = players.find((item) => item.id === offer.playerId);
              const exchangePlayer = offer.exchangePlayerId ? players.find((item) => item.id === offer.exchangePlayerId) : undefined;
              return (
                <div key={offer.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{player?.name ?? "Jugador"}</div>
                    <div className="text-xs text-slate-500">
                      {offer.status}
                      {exchangePlayer ? ` - intercambio: ${exchangePlayer.name}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-sm font-black text-emerald-200">{formatMoney(offer.amount)}</div>
                    {offer.status === "pending" ? (
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-300/25 bg-rose-500/10 text-rose-100"
                        aria-label="Eliminar puja u oferta"
                        onClick={() => void runAction(() => cancelOffer(offer.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {sentOffers.length === 0 ? <p className="text-sm text-slate-400">Aun no participas en subastas ni has enviado ofertas.</p> : null}
          </div>
        </Card>
      </div>
      <PlayerDetailDrawer player={selectedPlayer} onClose={() => setSelectedPlayer(undefined)} />
    </div>
  );
};
