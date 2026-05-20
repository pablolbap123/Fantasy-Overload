import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpFromLine, CheckCircle2, Gavel, Lock, RotateCcw, ShieldPlus, Store, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "../../types";
import { useFantasy } from "../../store/fantasyStore";
import { buildPlayerPointBreakdown } from "../../utils/calculatePoints";
import { getErrorMessage } from "../../utils/errors";
import { formatMoney, positionLabel, positionTone, statusLabel, statusTone } from "../../utils/formatters";
import { getHighestBid, getNextBidAmount, roundBidAmount } from "../../utils/market";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { PlayerAvatar } from "./PlayerAvatar";

export const PlayerDetailDrawer = ({ player, onClose }: { player?: Player; onClose: () => void }) => {
  const {
    matchdays,
    scoringRules,
    leaguePlayers,
    userId,
    members,
    offers,
    buyPlayer,
    makeOffer,
    raisePlayerClause,
    sellPlayer,
    listPlayerOnMarket,
    cancelMarketListing,
  } = useFantasy();
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedNumber(null);
    setShowActions(false);
    setActionError("");
  }, [player?.id]);

  const appearances = useMemo(() => {
    if (!player) return [];
    return matchdays
      .flatMap((matchday) =>
        matchday.matches.flatMap((match) =>
          match.playerStats
            .filter((stat) => stat.playerId === player.id)
            .map((stat) => ({
              matchdayNumber: matchday.number,
              match,
              stat,
              points: stat.fantasyPoints ?? 0,
            })),
        ),
      )
      .sort((a, b) => a.matchdayNumber - b.matchdayNumber);
  }, [matchdays, player]);

  const visibleMatchdays = useMemo(() => {
    if (!player) return [];
    const numbers = new Set<number>(matchdays.map((matchday) => matchday.number));
    Object.keys(player.pointsByMatchday).forEach((number) => numbers.add(Number(number)));
    return [...numbers].filter(Boolean).sort((a, b) => a - b);
  }, [matchdays, player]);

  const activeNumber = selectedNumber ?? appearances.at(-1)?.matchdayNumber ?? visibleMatchdays.at(-1) ?? 1;
  const selectedAppearance = appearances.find((item) => item.matchdayNumber === activeNumber);
  const selectedStat = selectedAppearance?.stat;
  const breakdown = player && selectedStat ? buildPlayerPointBreakdown(selectedStat, scoringRules, player.position) : [];
  const selectedPoints = selectedStat?.fantasyPoints ?? player?.pointsByMatchday[activeNumber] ?? 0;
  const maxAbsPoints = Math.max(1, ...visibleMatchdays.map((number) => Math.abs(player?.pointsByMatchday[number] ?? 0)));
  const leaguePlayer = player ? leaguePlayers.find((item) => item.playerId === player.id) : undefined;
  const owner = leaguePlayer?.ownerUserId ? members.find((member) => member.userId === leaguePlayer.ownerUserId) : undefined;
  const listedBy = leaguePlayer?.listedByUserId ? members.find((member) => member.userId === leaguePlayer.listedByUserId) : undefined;
  const isMine = Boolean(leaguePlayer?.ownerUserId && leaguePlayer.ownerUserId === userId);
  const isMyListing = Boolean(leaguePlayer?.listedByUserId && leaguePlayer.listedByUserId === userId);
  const isListed = Boolean(leaguePlayer?.marketStatus === "market" && leaguePlayer.marketExpiresAt && !leaguePlayer.ownerUserId);
  const highestBid = player ? getHighestBid(offers, player.id) : undefined;
  const nextBidAmount = player && leaguePlayer ? getNextBidAmount(leaguePlayer.price, highestBid) : 0;
  const quickSellAmount = leaguePlayer ? roundBidAmount(leaguePlayer.price * 0.5) : 0;
  const nextClause = leaguePlayer ? roundBidAmount(Math.max(leaguePlayer.releaseClause * 1.1, leaguePlayer.releaseClause + 1_000_000)) : 0;
  const nextClauseCost = leaguePlayer ? roundBidAmount((nextClause - leaguePlayer.releaseClause) * 0.2) : 0;

  const runPlayerAction = async (key: string, action: () => Promise<void>) => {
    setActionError("");
    setActionLoading(key);
    try {
      await action();
    } catch (err) {
      setActionError(getErrorMessage(err, "No se pudo completar la accion."));
    } finally {
      setActionLoading("");
    }
  };

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeNumber, player?.id]);

  return (
    <AnimatePresence>
      {player ? (
        <motion.div
          className="fixed inset-0 z-50 bg-slate-950/70 p-3 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            className="ml-auto flex h-full max-w-2xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <Card className="flex h-full flex-col overflow-hidden p-0">
              <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,.22),transparent_34%),linear-gradient(135deg,rgba(148,163,184,.16),rgba(15,23,42,.9))] p-4 sm:p-5">
                <Button variant="ghost" className="absolute right-3 top-3 px-3" onClick={onClose} aria-label="Cerrar">
                  <X className="h-5 w-5" />
                </Button>

                <div className="grid gap-4 pr-12 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg bg-slate-950/40 ring-1 ring-white/10 sm:h-36 sm:w-36">
                    <div className="scale-[2.15]">
                      <PlayerAvatar player={player} size="lg" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={positionTone[player.position]}>{player.position}</Badge>
                      <h2 className="min-w-0 truncate text-2xl font-black text-white sm:text-3xl">{player.name}</h2>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 font-bold text-emerald-100">
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                        {statusLabel[player.status]}
                      </span>
                      <span className="font-bold text-slate-200">{player.teamName}</span>
                    </div>
                    <div className="mt-4 grid max-w-md grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white/10 px-3 py-2">
                        <div className="text-xs text-slate-300">Valor</div>
                        <div className="text-base font-black text-white">{formatMoney(player.currentPrice)}</div>
                      </div>
                      <div className="rounded-lg bg-white/10 px-3 py-2">
                        <div className="text-xs text-slate-300">Estado</div>
                        <Badge className={statusTone[player.status]}>{statusLabel[player.status]}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:block sm:space-y-2 sm:text-right">
                    <div>
                      <div className="text-xs uppercase text-slate-400">PFSY</div>
                      <div className="text-3xl font-black text-white">{player.totalPoints}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-400">Media</div>
                      <div className="text-xl font-black text-white">{player.fantasyValue}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-400">Pos.</div>
                      <div className="text-xl font-black text-white">{positionLabel[player.position]}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<TrendingUp className="h-4 w-4" />}>
                    Valor historico
                  </Button>
                  <Button variant="danger" icon={<Lock className="h-4 w-4" />} onClick={() => setShowActions((current) => !current)}>
                    Acciones
                  </Button>
                </div>

                {showActions ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/45 p-3">
                    <div className="mb-3 text-sm font-bold text-slate-200">
                      {isMine
                        ? "Gestiona tu jugador"
                        : owner
                          ? `Pertenece a ${owner.username}`
                          : isMyListing
                            ? "Lo tienes puesto en mercado"
                          : isListed
                            ? `En mercado${listedBy ? ` por ${listedBy.username}` : ""}`
                            : "Jugador libre"}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {isMine ? (
                        <>
                          <Button
                            variant="secondary"
                            loading={actionLoading === "clause"}
                            icon={<ShieldPlus className="h-4 w-4" />}
                            onClick={() => void runPlayerAction("clause", () => raisePlayerClause(player.id, nextClause))}
                          >
                            Subir clausula {formatMoney(nextClauseCost)}
                          </Button>
                          <Button
                            variant="danger"
                            loading={actionLoading === "quickSell"}
                            icon={<ArrowUpFromLine className="h-4 w-4" />}
                            onClick={() => {
                              if (window.confirm(`Vender rapido a ${player.name} por ${formatMoney(quickSellAmount)}?`)) {
                                void runPlayerAction("quickSell", () => sellPlayer(player.id));
                              }
                            }}
                          >
                            Venta rapida {formatMoney(quickSellAmount)}
                          </Button>
                          <Button
                            loading={actionLoading === "list"}
                            icon={<Store className="h-4 w-4" />}
                            onClick={() => void runPlayerAction("list", () => listPlayerOnMarket(player.id))}
                          >
                            Anadir al mercado
                          </Button>
                        </>
                      ) : null}
                      {!isMine && owner && leaguePlayer?.releaseClause ? (
                        <Button
                          variant="danger"
                          loading={actionLoading === "buyClause"}
                          icon={<ShieldPlus className="h-4 w-4" />}
                          onClick={() => void runPlayerAction("buyClause", () => buyPlayer(player.id, leaguePlayer.releaseClause))}
                        >
                          Pagar clausula {formatMoney(leaguePlayer.releaseClause)}
                        </Button>
                      ) : null}
                      {!isMine && isListed ? (
                        <Button
                          loading={actionLoading === "bid"}
                          icon={<Gavel className="h-4 w-4" />}
                          onClick={() => void runPlayerAction("bid", () => makeOffer(player.id, nextBidAmount))}
                        >
                          Pujar {formatMoney(nextBidAmount)}
                        </Button>
                      ) : null}
                      {isMyListing ? (
                        <Button
                          variant="secondary"
                          loading={actionLoading === "cancelListing"}
                          icon={<RotateCcw className="h-4 w-4" />}
                          onClick={() => void runPlayerAction("cancelListing", () => cancelMarketListing(player.id))}
                        >
                          Quitar del mercado
                        </Button>
                      ) : null}
                    </div>
                    {actionError ? <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{actionError}</div> : null}
                  </div>
                ) : null}
              </div>

              <div className="border-b border-white/10 bg-slate-950/70 px-4 py-3">
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleMatchdays.length)}, minmax(0, 1fr))` }}
                >
                  {visibleMatchdays.map((number) => {
                    const points = player.pointsByMatchday[number] ?? appearances.find((item) => item.matchdayNumber === number)?.points ?? 0;
                    const active = number === activeNumber;
                    return (
                      <button key={number} className="min-w-0 text-center" onClick={() => setSelectedNumber(number)}>
                        <div className={active ? "rounded-t-lg bg-white px-1 py-2 text-slate-950" : "px-1 py-2 text-slate-300"}>J{number}</div>
                        <div className="mt-2 flex h-11 items-end justify-center">
                          <div
                            className={`w-full rounded-t-md ${points < 0 ? "bg-rose-400" : "bg-emerald-400"}`}
                            style={{ height: `${Math.max(10, (Math.abs(points) / maxAbsPoints) * 38)}px` }}
                          />
                        </div>
                        <div className={`-mt-8 text-lg font-black ${active ? "text-white" : "text-slate-200"}`}>{points}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-900/80 p-4">
                <div className="mb-4 text-center">
                  <h3 className="text-xl font-black text-white">Jornada {activeNumber}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedAppearance
                      ? `${selectedAppearance.match.homeTeamName} ${selectedAppearance.match.homeScore ?? "-"}-${selectedAppearance.match.awayScore ?? "-"} ${selectedAppearance.match.awayTeamName}`
                      : "Sin estadisticas oficiales para este jugador."}
                  </p>
                </div>

                <div className="grid grid-cols-[.7fr_1.4fr_.7fr] border-b border-white/10 px-3 py-3 text-sm font-bold text-slate-400">
                  <span>Cantidad</span>
                  <span>Estadisticas</span>
                  <span className="text-right">Puntos</span>
                </div>
                <div>
                  {breakdown.map((item) => (
                    <div key={item.key} className="grid grid-cols-[.7fr_1.4fr_.7fr] border-b border-white/10 px-3 py-4 text-base">
                      <span className="font-black text-white">{item.quantity}</span>
                      <span className="text-slate-100">{item.label}</span>
                      <span className={`text-right font-black ${item.points < 0 ? "text-rose-300" : "text-emerald-300"}`}>{item.points}</span>
                    </div>
                  ))}
                  {breakdown.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-center text-sm text-slate-400">
                      No hay desglose cargado para esta jornada.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Puntos J" + activeNumber, selectedPoints],
                    ["Goles", player.stats.goals],
                    ["Asistencias", player.stats.assists],
                    ["Nota Overload", player.stats.overloadPoints],
                    ["Goles encajados", player.stats.goalsConceded],
                    ["Porterias a cero", player.stats.cleanSheets],
                    ["Tarjetas", player.stats.yellowCards + player.stats.redCards],
                    ["Precio", formatMoney(player.currentPrice)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="mt-1 text-lg font-black text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
