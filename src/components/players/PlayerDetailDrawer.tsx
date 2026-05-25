import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpFromLine, CheckCircle2, Gavel, Lock, RotateCcw, ShieldPlus, Store, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "../../types";
import { useFantasy } from "../../store/fantasyStore";
import { buildPlayerPointBreakdown, playerPositions } from "../../utils/calculatePoints";
import { getPlayerTeamForMatchday } from "../../data/transferOverrides";
import { getErrorMessage } from "../../utils/errors";
import { formatMoney, positionLabel, positionTone, statusLabel, statusTone } from "../../utils/formatters";
import { getHighestBid, getMinimumBidAmount, roundBidAmount } from "../../utils/market";
import { availabilityText, isUnavailableForMatchday, playerMatchdayPoints } from "../../utils/playerAvailability";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { PlayerAvatar } from "./PlayerAvatar";

export const PlayerDetailDrawer = ({ player, onClose }: { player?: Player; onClose: () => void }) => {
  const {
    matchdays,
    scoringRules,
    players,
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
  const [showValueHistory, setShowValueHistory] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [clauseSpend, setClauseSpend] = useState("1000000");
  const [exchangePlayerId, setExchangePlayerId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedNumber(null);
    setShowActions(false);
    setShowValueHistory(false);
    setOfferAmount("");
    setClauseSpend("1000000");
    setExchangePlayerId("");
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
  const emptyMatchStat = player ? {
    matchId: "", playerId: player.id,
    minutes: 0, goals: 0, assists: 0, keyPasses: 0,
    yellowCards: 0, redCards: 0, doubleYellowCards: 0, ownGoals: 0,
    penaltiesScored: 0, penaltiesMissed: 0, penaltiesSaved: 0, penaltiesProvoked: 0,
    goalsConceded: 0, cleanSheet: false, overloadScore: 0, overloadRating: 0,
    mvp: false, teamWon: false, teamLost: false, highlighted: false, errorLedToGoal: false,
    saves: 0, shotsOnTarget: 0, successfulDribbles: 0, boxEntries: 0,
    ballsLost: 0, ballsRecovered: 0, clearances: 0, fantasyPoints: 0,
  } : null;
  const breakdown = player
    ? buildPlayerPointBreakdown(selectedStat ?? emptyMatchStat!, scoringRules, player.position, true)
    : [];
  const teamForMatchday = player
    ? getPlayerTeamForMatchday(player.id, activeNumber, player.teamId, player.teamName)
    : null;
  const selectedPoints = player ? playerMatchdayPoints(player, activeNumber) : 0;
  const maxAbsPoints = Math.max(1, ...visibleMatchdays.map((number) => Math.abs(player ? playerMatchdayPoints(player, number) : 0)));
  const playersById = useMemo(() => new Map(players.map((item) => [item.id, item])), [players]);
  const leaguePlayer = player ? leaguePlayers.find((item) => item.playerId === player.id) : undefined;
  const owner = leaguePlayer?.ownerUserId ? members.find((member) => member.userId === leaguePlayer.ownerUserId) : undefined;
  const myMember = members.find((member) => member.userId === userId);
  const listedBy = leaguePlayer?.listedByUserId ? members.find((member) => member.userId === leaguePlayer.listedByUserId) : undefined;
  const isMine = Boolean(leaguePlayer?.ownerUserId && leaguePlayer.ownerUserId === userId);
  const isMyListing = Boolean(leaguePlayer?.listedByUserId && leaguePlayer.listedByUserId === userId);
  const isListed = Boolean(
    leaguePlayer?.marketStatus === "market" &&
      leaguePlayer.marketExpiresAt &&
      (!leaguePlayer.ownerUserId || Boolean(leaguePlayer.listedByUserId)),
  );
  const highestBid = player ? getHighestBid(offers, player.id) : undefined;
  const nextBidAmount = player && leaguePlayer ? getMinimumBidAmount(leaguePlayer.price, highestBid) : 0;
  const quickSellAmount = leaguePlayer ? roundBidAmount(leaguePlayer.price * 0.5) : 0;
  const parsedClauseSpend = Number(clauseSpend.replace(/[^\d]/g, ""));
  const clauseSpendAmount = Number.isFinite(parsedClauseSpend) ? roundBidAmount(parsedClauseSpend) : 0;
  const clauseIncrease = clauseSpendAmount * 3;
  const projectedClause = leaguePlayer ? leaguePlayer.releaseClause + clauseIncrease : 0;
  const projectedBudget = myMember ? myMember.budget - clauseSpendAmount : 0;
  const myPlayers = leaguePlayers
    .filter((item) => item.ownerUserId === userId && item.playerId !== player?.id)
    .map((item) => playersById.get(item.playerId))
    .filter(Boolean) as Player[];
  const clauseLockedUntil = leaguePlayer?.clauseLockedUntil ? new Date(leaguePlayer.clauseLockedUntil) : null;
  const isClauseLocked = Boolean(clauseLockedUntil && clauseLockedUntil.getTime() > Date.now());
  const suggestedOffer = leaguePlayer && player ? roundBidAmount(Math.max(leaguePlayer.price, player.currentPrice) * 1.05) : 0;
  const parsedOfferAmount = Number(offerAmount || suggestedOffer);
  const valueHistory = player ? visibleMatchdays.map((number, index) => {
    const points = playerMatchdayPoints(player, number);
    const storedValue = player.priceHistory?.[number];
    const cumulativePoints = visibleMatchdays
      .slice(0, index + 1)
      .reduce((sum, item) => sum + playerMatchdayPoints(player, item), 0);
    const estimatedValue = storedValue ?? roundBidAmount(Math.max(500_000, player.basePrice + cumulativePoints * 250_000 + points * 150_000));
    return { number, points, estimatedValue };
  }) : [];

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
          className="fixed inset-0 z-50 bg-slate-950/70 p-2 backdrop-blur sm:p-3"
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
            <Card className="flex h-full max-h-[calc(100dvh-1rem)] flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-1.5rem)]">
              <div className="thin-scrollbar relative max-h-[62dvh] overflow-y-auto border-b border-white/10 bg-[linear-gradient(135deg,rgba(56,189,248,.18),rgba(15,23,42,.92)_48%,rgba(245,189,67,.1))] p-4 sm:max-h-none sm:overflow-visible sm:p-5">
                <Button variant="ghost" className="absolute right-3 top-3 z-10 px-3" onClick={onClose} aria-label="Cerrar">
                  <X className="h-5 w-5" />
                </Button>

                <div className="grid gap-4 pr-10 sm:grid-cols-[auto_1fr_auto] sm:items-start sm:pr-12">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg bg-slate-950/40 ring-1 ring-white/10 sm:h-36 sm:w-36">
                    <div className="scale-[2.15]">
                      <PlayerAvatar player={player} size="lg" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {playerPositions(player).map((position) => (
                        <Badge key={position} className={positionTone[position]}>{position}</Badge>
                      ))}
                      <h2 className="min-w-0 truncate text-2xl font-black text-white sm:text-3xl">{player.name}</h2>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 font-bold text-emerald-100">
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                        {statusLabel[player.status]}
                      </span>
                      <span className="font-bold text-slate-200">{teamForMatchday?.teamName ?? player.teamName}</span>
                    </div>
                    <div className="mt-4 grid max-w-md grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                      <div className="rounded-lg bg-white/10 px-3 py-2">
                        <div className="text-xs text-slate-300">Valor</div>
                        <div className="text-base font-black text-white">{formatMoney(player.currentPrice)}</div>
                      </div>
                      <div className="rounded-lg bg-white/10 px-3 py-2">
                        <div className="text-xs text-slate-300">Clausula</div>
                        <div className="text-base font-black text-white">{leaguePlayer?.releaseClause ? formatMoney(leaguePlayer.releaseClause) : "-"}</div>
                      </div>
                      <div className="rounded-lg bg-white/10 px-3 py-2">
                          <div className="text-xs text-slate-300">Estado</div>
                        <Badge className={statusTone[player.status]}>{statusLabel[player.status]}</Badge>
                        {availabilityText(player, activeNumber) ? (
                          <div className="mt-1 text-[11px] font-bold text-rose-100">{availabilityText(player, activeNumber)}</div>
                        ) : null}
                      </div>
                      <div className="rounded-lg bg-white/10 px-3 py-2">
                        <div className="text-xs text-slate-300">Bloqueo</div>
                        <div className="text-sm font-black text-white">{isClauseLocked ? `${Math.ceil((clauseLockedUntil!.getTime() - Date.now()) / 86_400_000)} dias` : "Libre"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:w-28 sm:grid-cols-1 sm:text-right">
                    <div className="rounded-lg bg-slate-950/35 px-2 py-2 ring-1 ring-white/10">
                      <div className="text-xs uppercase text-slate-400">PFSY</div>
                      <div className="text-3xl font-black text-white">{player.totalPoints}</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/35 px-2 py-2 ring-1 ring-white/10">
                      <div className="text-xs uppercase text-slate-400">Media</div>
                      <div className="text-xl font-black text-white">{player.fantasyValue}</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/35 px-2 py-2 ring-1 ring-white/10">
                      <div className="text-xs uppercase text-slate-400">Pos.</div>
                      <div className="text-xl font-black text-white">{playerPositions(player).map((position) => positionLabel[position]).join("/")}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<TrendingUp className="h-4 w-4" />} onClick={() => setShowValueHistory((current) => !current)}>
                    Valor historico
                  </Button>
                  <Button variant="danger" icon={<Lock className="h-4 w-4" />} onClick={() => setShowActions((current) => !current)}>
                    Acciones
                  </Button>
                </div>

                {showValueHistory ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/45 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-sm font-black text-white">Valor historico</div>
                      <div className="text-xs font-bold text-slate-300">Actual {formatMoney(player.currentPrice)}</div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {valueHistory.map((item) => (
                        <div key={item.number} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
                          <div className="text-xs font-black uppercase text-slate-400">J{item.number}</div>
                          <div className="mt-1 text-base font-black text-white">{formatMoney(item.estimatedValue)}</div>
                          <div className={`text-xs font-black ${item.points < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                            {item.points > 0 ? "+" : ""}{item.points} pts
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

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
                    {!isMine && owner ? (
                      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr]">
                        <input
                          className="field"
                          inputMode="numeric"
                          value={offerAmount}
                          onChange={(event) => setOfferAmount(event.target.value)}
                          placeholder={`Oferta sugerida ${formatMoney(suggestedOffer)}`}
                        />
                        <select className="field" value={exchangePlayerId} onChange={(event) => setExchangePlayerId(event.target.value)}>
                          <option value="">Sin intercambio</option>
                          {myPlayers.map((ownedPlayer) => (
                            <option key={ownedPlayer.id} value={ownedPlayer.id}>
                              {ownedPlayer.name} · {formatMoney(ownedPlayer.currentPrice)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {isMine ? (
                        <>
                          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3 sm:col-span-2">
                            <div className="flex flex-wrap items-end gap-2">
                              <label className="min-w-0 flex-1">
                                <span className="mb-1 block text-xs font-black uppercase text-slate-400">Invertir en clausula</span>
                                <input
                                  className="field"
                                  inputMode="numeric"
                                  value={clauseSpend}
                                  onChange={(event) => setClauseSpend(event.target.value)}
                                  placeholder="1000000"
                                />
                              </label>
                              <Button
                                variant="secondary"
                                loading={actionLoading === "clause"}
                                icon={<ShieldPlus className="h-4 w-4" />}
                                disabled={!myMember || clauseSpendAmount <= 0 || projectedBudget < 0}
                                onClick={() => void runPlayerAction("clause", () => raisePlayerClause(player.id, clauseSpendAmount))}
                              >
                                Subir clausula
                              </Button>
                            </div>
                            <div className="mt-2 grid gap-2 text-xs font-bold text-slate-300 sm:grid-cols-3">
                              <span>Sube {formatMoney(clauseIncrease)}</span>
                              <span>Nueva {formatMoney(projectedClause)}</span>
                              <span className={projectedBudget < 0 ? "text-rose-300" : "text-emerald-300"}>
                                Te quedas con {formatMoney(Math.max(projectedBudget, 0))}
                              </span>
                            </div>
                          </div>
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
                        <>
                          <Button
                            loading={actionLoading === "offer"}
                            icon={<Gavel className="h-4 w-4" />}
                            onClick={() => void runPlayerAction("offer", () => makeOffer(player.id, parsedOfferAmount || suggestedOffer, null))}
                          >
                            Oferta {formatMoney(parsedOfferAmount || suggestedOffer)}
                          </Button>
                          <Button
                            variant="secondary"
                            loading={actionLoading === "exchange"}
                            icon={<RotateCcw className="h-4 w-4" />}
                            disabled={!exchangePlayerId}
                            onClick={() => void runPlayerAction("exchange", () => makeOffer(player.id, parsedOfferAmount || 0, exchangePlayerId))}
                          >
                            Intercambio
                          </Button>
                      <Button
                        className="sm:col-span-2"
                        variant="danger"
                        loading={actionLoading === "buyClause"}
                            icon={<ShieldPlus className="h-4 w-4" />}
                            disabled={isClauseLocked}
                            onClick={() => void runPlayerAction("buyClause", () => buyPlayer(player.id, leaguePlayer.releaseClause))}
                          >
                            {isClauseLocked ? `Clausula bloqueada ${Math.ceil((clauseLockedUntil!.getTime() - Date.now()) / 86_400_000)}d` : `Pagar clausula ${formatMoney(leaguePlayer.releaseClause)}`}
                          </Button>
                        </>
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

              <div className="thin-scrollbar overflow-x-auto border-b border-white/10 bg-slate-950/70 px-4 py-3">
                <div
                  className="grid min-w-max gap-2"
                  style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleMatchdays.length)}, minmax(4.25rem, 1fr))` }}
                >
                  {visibleMatchdays.map((number) => {
                    const points = playerMatchdayPoints(player, number);
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

              <div ref={contentRef} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto bg-slate-900/80 p-4">
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
                  {isUnavailableForMatchday(player, activeNumber) ? (
                    <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-4 text-center text-sm font-semibold text-rose-100">
                      No suma en J{activeNumber}: {availabilityText(player, activeNumber)}.
                    </div>
                  ) : null}
                  {!isUnavailableForMatchday(player, activeNumber) && breakdown.map((item) => (
                    <div key={item.key} className="grid grid-cols-[.7fr_1.4fr_.7fr] border-b border-white/10 px-3 py-4 text-base">
                      <span className="font-black text-white">{item.quantity}</span>
                      <span className="text-slate-100">{item.label}</span>
                      <span className={`text-right font-black ${item.points < 0 ? "text-rose-300" : "text-emerald-300"}`}>{item.points}</span>
                    </div>
                  ))}
                  {!isUnavailableForMatchday(player, activeNumber) && !selectedStat ? (
                    <div className="mb-1 rounded-lg border border-amber-300/20 bg-amber-500/10 p-3 text-center text-xs font-semibold text-amber-200">
                      Sin estadísticas guardadas para J{activeNumber} — mostrando desglose vacío.
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
