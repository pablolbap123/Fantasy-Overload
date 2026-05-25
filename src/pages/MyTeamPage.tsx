import { ArrowRightLeft, Crown, Eye, Lock, Save, ShoppingBag, Shuffle, Trash2, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Formation, Lineup, Player } from "../types";
import { FormationBoard } from "../components/fantasy/FormationBoard";
import { PlayerAvatar } from "../components/players/PlayerAvatar";
import { PlayerDetailDrawer } from "../components/players/PlayerDetailDrawer";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useFantasy } from "../store/fantasyStore";
import { formationShape, normalizePlayerPosition, playerPositions, positionOrder, validateLineup } from "../utils/calculatePoints";
import { formatMoney, positionTone } from "../utils/formatters";
import { availabilityText, isUnavailableForMatchday, playerMatchdayPoints } from "../utils/playerAvailability";

const formations = Object.keys(formationShape) as Formation[];

const lineupForMatchday = (lineups: Lineup[], userId: string | null, matchdayId?: string) => {
  if (!matchdayId) return undefined;
  return [...lineups]
    .filter((lineup) => lineup.userId === userId && lineup.matchdayId === matchdayId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
};

const REQUIRED_MATCHES_PER_MATCHDAY = 14;

const matchdayHasCompleteResults = (matchday?: { matches?: Array<{ status: string; homeScore?: number | null; awayScore?: number | null }> }) =>
  Boolean(
    matchday?.matches?.length &&
      matchday.matches.length >= REQUIRED_MATCHES_PER_MATCHDAY &&
      matchday.matches.every((match) => match.status === "finalizada" && match.homeScore !== null && match.awayScore !== null),
  );

const emptyStats = {
  appearances: 0,
  goals: 0,
  assists: 0,
  goalsConceded: 0,
  cleanSheets: 0,
  yellowCards: 0,
  redCards: 0,
  doubleYellowCards: 0,
  penaltiesScored: 0,
  penaltiesMissed: 0,
  penaltiesSaved: 0,
  penaltiesProvoked: 0,
  ownGoals: 0,
  mvps: 0,
  overloadPoints: 0,
  minutes: 0,
  keyActions: 0,
};

const missingSnapshotPlayer = (playerId: string, position: Player["position"]): Player => ({
  id: playerId,
  name: "Jugador transferido",
  teamId: "snapshot",
  teamName: "-",
  position,
  positions: [position],
  basePrice: 0,
  currentPrice: 0,
  fantasyValue: 0,
  totalPoints: 0,
  pointsByMatchday: {},
  status: "disponible",
  stats: emptyStats,
});

export const MyTeamPage = () => {
  const { currentLeague, userId, leaguePlayers, players, members, lineups, matchdays, submitLineup, setLineupCaptain, sellPlayer } = useFantasy();
  const sortedMatchdays = useMemo(() => [...matchdays].sort((a, b) => a.number - b.number), [matchdays]);
  const latestCompletedMatchdayNumber = sortedMatchdays.filter(matchdayHasCompleteResults).at(-1)?.number ?? 0;
  const openMatchdayNumber = currentLeague?.currentMatchday ?? Math.max(1, latestCompletedMatchdayNumber + 1);
  const [selectedMatchdayNumber, setSelectedMatchdayNumber] = useState(openMatchdayNumber);
  const [formation, setFormation] = useState<Formation>("4-4-2");
  const [starterIds, setStarterIds] = useState<string[]>([]);
  const [benchIds, setBenchIds] = useState<string[]>([]);
  const [captainPlayerId, setCaptainPlayerId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | undefined>();
  const [swapCandidate, setSwapCandidate] = useState<Player | undefined>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Squad = jugadores que poseo + los que tengo en el mercado (aún míos hasta que se vendan)
  const myLeaguePlayers = useMemo(
    () => leaguePlayers.filter((item) => item.ownerUserId === userId || item.listedByUserId === userId),
    [leaguePlayers, userId],
  );

  const squad = useMemo(
    () =>
      myLeaguePlayers
        .map((item) => players.find((player) => player.id === item.playerId))
        .filter(Boolean)
        .sort((a, b) =>
          a!.position === b!.position
            ? b!.totalPoints - a!.totalPoints
            : positionOrder.indexOf(a!.position) - positionOrder.indexOf(b!.position),
        ) as Player[],
    [myLeaguePlayers, players],
  );

  const me = members.find((member) => member.userId === userId);
  const activeMatchday = matchdays.find((matchday) => matchday.number === selectedMatchdayNumber);
  const activeLineup = lineupForMatchday(lineups, userId, activeMatchday?.id);
  const isEditable = selectedMatchdayNumber === openMatchdayNumber && !activeLineup && !currentLeague?.lineupsLocked;
  const canChangeCaptain = selectedMatchdayNumber === openMatchdayNumber && Boolean(activeLineup) && !currentLeague?.lineupsLocked;

  const availableMatchdayNumbers = useMemo(() => {
    const numbers = new Set<number>();
    matchdays.forEach((matchday) => {
      if (matchdayHasCompleteResults(matchday)) numbers.add(matchday.number);
    });
    numbers.add(openMatchdayNumber);
    lineups
      .filter((lineup) => lineup.userId === userId)
      .forEach((lineup) => {
        const found = matchdays.find((matchday) => matchday.id === lineup.matchdayId);
        if (found) numbers.add(found.number);
      });
    return [...numbers].sort((a, b) => a - b);
  }, [lineups, matchdays, openMatchdayNumber, userId]);

  useEffect(() => {
    setSelectedMatchdayNumber((current) => (availableMatchdayNumbers.includes(current) ? current : openMatchdayNumber));
  }, [availableMatchdayNumbers, openMatchdayNumber]);

  const starters = Array.from(new Set(starterIds))
    .map((id) => squad.find((player) => player.id === id))
    .filter(Boolean) as Player[];
  const starterSet = new Set(starters.map((player) => player.id));
  const bench = Array.from(new Set(benchIds))
    .filter((id) => !starterSet.has(id))
    .map((id) => squad.find((player) => player.id === id))
    .filter(Boolean) as Player[];

  // For past/submitted lineups, use snapshot players (may include sold players)
  const lineupPlayers = useMemo(() => {
    if (!activeLineup) return null;
    return activeLineup.players.map((lp) => {
      const player = players.find((p) => p.id === lp.playerId);
      return player ?? missingSnapshotPlayer(lp.playerId, normalizePlayerPosition(lp.position));
    });
  }, [activeLineup, players]);

  const squadPointsFor = (matchdayNumber: number) => {
    const lineup = lineups.find((l) => l.userId === userId && matchdays.find((m) => m.id === l.matchdayId)?.number === matchdayNumber);
    if (lineup) {
      const starterPlayerIds = lineup.players.filter((p) => p.isStarter).map((p) => p.playerId);
      return starterPlayerIds.reduce((sum, pid) => {
        const player = players.find((p) => p.id === pid);
        if (!player) return sum;
        const pts = playerMatchdayPoints(player, matchdayNumber);
        const isCapt = lineup.captainPlayerId === pid;
        return sum + (isCapt ? pts * 2 : pts);
      }, 0);
    }
    return 0;
  };

  useEffect(() => {
    if (activeLineup) {
      setFormation(activeLineup.formation);
      setCaptainPlayerId(activeLineup.captainPlayerId ?? null);
      const nextStarters = Array.from(new Set(activeLineup.players.filter((player) => player.isStarter).map((player) => player.playerId)));
      setStarterIds(nextStarters);
      setBenchIds(
        Array.from(new Set(activeLineup.players.filter((player) => !player.isStarter).map((player) => player.playerId))).filter(
          (playerId) => !nextStarters.includes(playerId),
        ),
      );
      return;
    }

    if (!isEditable) {
      setStarterIds([]);
      setBenchIds([]);
      return;
    }

    const picked = new Set<string>();
    const shape = formationShape["4-4-2"];
    const startersByDefault = positionOrder.flatMap((position) =>
      squad
        .filter((player) => !picked.has(player.id) && playerPositions(player).includes(position) && !isUnavailableForMatchday(player, selectedMatchdayNumber))
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, shape[position])
        .map((player) => {
          picked.add(player.id);
          return player.id;
        }),
    );
    setFormation("4-4-2");
    setStarterIds(startersByDefault);
    setBenchIds(squad.filter((player) => !startersByDefault.includes(player.id)).map((player) => player.id));
    setCaptainPlayerId(null);
  }, [activeLineup, isEditable, selectedMatchdayNumber, squad]);

  const validation = useMemo(
    () => validateLineup(squad, starterIds, formation, selectedMatchdayNumber),
    [formation, selectedMatchdayNumber, squad, starterIds],
  );

  const moveToStarter = (playerId: string) => {
    if (!isEditable) return;
    const player = squad.find((item) => item.id === playerId);
    if (!player) return;
    if (isUnavailableForMatchday(player, selectedMatchdayNumber)) {
      setError(`${player.name} no puede ser titular: ${availabilityText(player, selectedMatchdayNumber)}.`);
      return;
    }
    const nextStarters = Array.from(new Set([...starterIds, playerId]));
    if (nextStarters.length > 11 || (nextStarters.length === 11 && !validateLineup(squad, nextStarters, formation, selectedMatchdayNumber).valid)) {
      setSwapCandidate(player);
      return;
    }
    setStarterIds(nextStarters);
    setBenchIds((current) => current.filter((id) => id !== playerId));
  };

  const replaceStarter = (benchPlayer: Player, starterPlayer: Player) => {
    setStarterIds((current) => current.map((id) => (id === starterPlayer.id ? benchPlayer.id : id)));
    setBenchIds((current) => current.filter((id) => id !== benchPlayer.id).concat(starterPlayer.id));
    if (captainPlayerId === starterPlayer.id) setCaptainPlayerId(benchPlayer.id);
    setSwapCandidate(undefined);
  };

  const moveToBench = (playerId: string) => {
    if (!isEditable) return;
    setStarterIds((current) => current.filter((id) => id !== playerId));
    setBenchIds((current) => (current.includes(playerId) ? current : [...current, playerId]));
    if (captainPlayerId === playerId) setCaptainPlayerId(null);
  };

  const toggleCaptain = async (playerId: string) => {
    if (activeLineup && !isEditable) {
      setError("");
      setSaving(true);
      try {
        await setLineupCaptain(activeLineup.id, activeLineup.captainPlayerId === playerId ? null : playerId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cambiar el capitan.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setCaptainPlayerId((current) => (current === playerId ? null : playerId));
  };

  const autofill = () => {
    if (!isEditable) return;
    const shape = formationShape[formation];
    const picked = new Set<string>();
    const startersByPoints = positionOrder.flatMap((position) =>
      squad
        .filter((player) => !picked.has(player.id) && playerPositions(player).includes(position) && !isUnavailableForMatchday(player, selectedMatchdayNumber))
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, shape[position])
        .map((player) => {
          picked.add(player.id);
          return player.id;
        }),
    );
    setStarterIds(startersByPoints);
    setBenchIds(squad.filter((player) => !startersByPoints.includes(player.id)).map((player) => player.id));
  };

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      if (captainPlayerId && !starterIds.includes(captainPlayerId)) {
        throw new Error("El capitan debe estar dentro del once titular.");
      }
      await submitLineup(formation, starterIds, benchIds, selectedMatchdayNumber, captainPlayerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la alineacion.");
    } finally {
      setSaving(false);
    }
  };

  if (squad.length === 0) {
    return <EmptyState title="Tu plantilla esta vacia" description="Compra jugadores en el mercado para construir tu once." />;
  }

  // For read-only view, use lineup snapshot players; for editable use current squad
  const boardPlayers = !isEditable && lineupPlayers ? lineupPlayers : squad;
  const boardStarterIds = !isEditable && activeLineup ? activeLineup.players.filter((p) => p.isStarter).map((p) => p.playerId) : starterIds;
  const boardCaptain = !isEditable && activeLineup ? activeLineup.captainPlayerId : captainPlayerId;
  const boardLineupPlayers = !isEditable && activeLineup
    ? activeLineup.players
    : boardStarterIds.map((playerId, slot) => {
        const player = squad.find((item) => item.id === playerId);
        return {
          playerId,
          slot,
          isStarter: true,
          position: validation.assignedPositions[playerId] ?? player?.position ?? "MED",
        };
      });

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black text-white">Mi equipo</h1>
          <p className="mt-1 text-sm font-semibold text-slate-300">
            Plantilla {squad.length} · Titulares {starters.length} · Banquillo {bench.length} · Valor {formatMoney(me?.squadValue ?? 0)} · Caja{" "}
            {formatMoney(me?.budget ?? 0)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Shuffle className="h-4 w-4" />} onClick={autofill} disabled={!isEditable}>
            Auto once
          </Button>
          <Button loading={saving} icon={<Save className="h-4 w-4" />} onClick={() => void save()} disabled={!isEditable}>
            Subir J{selectedMatchdayNumber}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-white">Onces guardados</h2>
            <p className="text-sm text-slate-300">Revisa jornadas anteriores y los puntos reales de cada titular.</p>
          </div>
          {!isEditable ? (
            <Badge className="bg-[#f5bd43]/20 text-[#ffe2a2] ring-[#f5bd43]/35">
              <Lock className="mr-1 h-3.5 w-3.5" /> Solo lectura
            </Badge>
          ) : null}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {availableMatchdayNumbers.map((number) => (
            <button
              key={number}
              className={`min-w-28 rounded-lg border px-3 py-2 text-left transition ${
                selectedMatchdayNumber === number
                  ? "border-[#4bb3fd]/60 bg-[#4bb3fd]/15 text-white"
                  : "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/10"
              }`}
              onClick={() => setSelectedMatchdayNumber(number)}
            >
              <div className="text-xs font-black uppercase text-slate-300">
                {number === openMatchdayNumber ? (activeLineup && selectedMatchdayNumber === number ? "Subida" : "Abierta") : "Resultados"}
              </div>
              <div className="text-lg font-black">J{number}</div>
              <div className="text-sm font-black text-[#21d17f]">{squadPointsFor(number)} pts</div>
            </button>
          ))}
        </div>
      </Card>

      {currentLeague?.lineupsLocked && selectedMatchdayNumber === openMatchdayNumber ? (
        <div className="rounded-lg border border-[#f5bd43]/25 bg-[#f5bd43]/15 p-3 text-sm font-semibold text-[#ffe2a2]">
          La alineacion esta bloqueada porque la jornada esta en curso.
        </div>
      ) : null}

      {(isEditable || canChangeCaptain) && (captainPlayerId || activeLineup?.captainPlayerId) && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          <Crown className="h-4 w-4 text-amber-400" />
          <span>
            Capitan: <strong>{boardPlayers.find((player) => player.id === (activeLineup?.captainPlayerId ?? captainPlayerId))?.name ?? "-"}</strong> · sus puntos se multiplican por x2
          </span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="overflow-hidden">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white">Once titular · J{selectedMatchdayNumber}</h2>
              <p className="text-sm font-black text-[#21d17f]">{squadPointsFor(selectedMatchdayNumber)} puntos</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isEditable && formations.map((item) => (
                <button
                  key={item}
                  className={`rounded-lg px-3 py-2 text-sm font-black transition ${
                    formation === item ? "bg-[#23c979] text-[#06130d]" : "bg-white/10 text-slate-100 hover:bg-white/15"
                  }`}
                  onClick={() => isEditable && setFormation(item)}
                  disabled={!isEditable}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {boardStarterIds.length > 0 ? (
            <FormationBoard
              formation={isEditable ? formation : (activeLineup?.formation ?? formation)}
              players={boardPlayers}
              starterIds={boardStarterIds}
              onPlayerClick={isEditable ? moveToBench : undefined}
              onPlayerDetail={setSelectedPlayer}
              matchdayNumber={selectedMatchdayNumber}
              readOnly={!isEditable}
              captainPlayerId={boardCaptain}
              onCaptainChange={isEditable || canChangeCaptain ? (playerId) => void toggleCaptain(playerId) : undefined}
              lineupPlayers={boardLineupPlayers}
            />
          ) : (
            <EmptyState title="No hay once guardado" description="No existe alineacion para esta jornada." />
          )}
          {isEditable && (
            <div className="mt-3 flex flex-wrap gap-2">
              {validation.valid ? (
                <Badge className="bg-[#21d17f]/20 text-[#a9ffd4] ring-[#21d17f]/35">Alineacion valida</Badge>
              ) : (
                validation.errors.map((item) => (
                  <Badge key={item} className="bg-[#ff3f55]/20 text-[#ffc0c8] ring-[#ff3f55]/35">
                    {item}
                  </Badge>
                ))
              )}
              {activeLineup ? <Badge className="bg-[#4bb3fd]/20 text-[#c5f2ff] ring-[#4bb3fd]/35">Guardada</Badge> : null}
            </div>
          )}
          {error ? <div className="mt-3 rounded-lg border border-[#ff3f55]/30 bg-[#ff3f55]/15 p-3 text-sm text-rose-100">{error}</div> : null}
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <h2 className="mb-3 text-base font-black text-white">Banquillo</h2>
            <div className="space-y-2">
              {bench.map((player) => {
                const isListed = leaguePlayers.find((lp) => lp.playerId === player.id)?.listedByUserId === userId;
                return (
                  <div key={player.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg bg-[#111a23] p-3 sm:flex">
                    <PlayerAvatar player={player} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-white">{player.name}</div>
                      <div className="truncate text-xs font-semibold text-slate-300">{player.teamName}</div>
                      <div className="mt-1 text-xs font-black text-[#f5bd43]">{formatMoney(player.currentPrice)}</div>
                      {isListed && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-300">
                          <ShoppingBag className="h-3 w-3" /> En venta (sigue en tu plantilla)
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex justify-end gap-1">
                        {playerPositions(player).map((position) => (
                          <Badge key={position} className={positionTone[position]}>{position}</Badge>
                        ))}
                      </div>
                      <div className="mt-1 text-sm font-black text-[#21d17f]">{playerMatchdayPoints(player, selectedMatchdayNumber)} pts</div>
                      {isUnavailableForMatchday(player, selectedMatchdayNumber) ? (
                        <div className="mt-1 text-[11px] font-bold text-rose-200">{availabilityText(player, selectedMatchdayNumber)}</div>
                      ) : null}
                    </div>
                    <div className="col-span-3 flex flex-wrap justify-end gap-2 sm:col-span-1">
                      <button className="rounded-lg p-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => setSelectedPlayer(player)} aria-label="Ver detalle">
                        <Eye className="h-4 w-4" />
                      </button>
                      {isEditable ? (
                        <>
                          <Button variant="secondary" className="px-3" icon={<UserRoundPlus className="h-4 w-4" />} onClick={() => moveToStarter(player.id)}>
                            Titular
                          </Button>
                          {!isListed && (
                            <button
                              className="rounded-lg p-2 text-rose-200 hover:bg-rose-500/10"
                              onClick={() => {
                                if (window.confirm(`Vender rapido a ${player.name} por la mitad de su precio de mercado?`)) void sellPlayer(player.id);
                              }}
                              aria-label="Vender"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <h2 className="mb-3 text-base font-black text-white">Puntos de plantilla · J{selectedMatchdayNumber}</h2>
            <div className="space-y-2">
              {squad
                .sort((a, b) => playerMatchdayPoints(b, selectedMatchdayNumber) - playerMatchdayPoints(a, selectedMatchdayNumber))
                .map((player) => {
                  const pts = playerMatchdayPoints(player, selectedMatchdayNumber);
                  const isCapt = activeLineup?.captainPlayerId === player.id || (isEditable && captainPlayerId === player.id);
                  const displayPts = isCapt ? pts * 2 : pts;
                  return (
                    <button
                      key={player.id}
                      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg bg-[#111a23] p-3 text-left hover:bg-[#162230]"
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <PlayerAvatar player={player} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">
                          {player.name}
                          {isCapt && <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-400" />}
                        </div>
                        <div className="truncate text-xs font-semibold text-slate-300">{player.teamName}</div>
                      </div>
                      <div className={`text-right text-lg font-black ${displayPts > 0 ? "text-[#21d17f]" : displayPts < 0 ? "text-rose-400" : "text-amber-400"}`}>
                        {displayPts}
                      </div>
                    </button>
                  );
                })}
            </div>
          </Card>
        </div>
      </div>

      {swapCandidate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur" onClick={() => setSwapCandidate(undefined)}>
          <Card className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-xl font-black text-white">Cambiar por titular</h2>
            <p className="mt-1 text-sm text-slate-300">
              Elige quien sale del once para que entre {swapCandidate.name}.
            </p>
            <div className="mt-4 space-y-2">
              {starters
                .filter((player) => playerPositions(player).some((position) => playerPositions(swapCandidate).includes(position)))
                .map((starter) => (
                  <button
                    key={starter.id}
                    className="flex w-full items-center gap-3 rounded-lg bg-[#111a23] p-3 text-left hover:bg-[#162230]"
                    onClick={() => replaceStarter(swapCandidate, starter)}
                  >
                    <PlayerAvatar player={starter} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-black text-white">{starter.name}</div>
                      <div className="text-xs text-slate-300">{playerMatchdayPoints(starter, selectedMatchdayNumber)} pts en J{selectedMatchdayNumber}</div>
                    </div>
                    <ArrowRightLeft className="h-5 w-5 text-[#4bb3fd]" />
                  </button>
                ))}
            </div>
            <Button className="mt-4 w-full" variant="secondary" onClick={() => setSwapCandidate(undefined)}>
              Cancelar
            </Button>
          </Card>
        </div>
      ) : null}

      <PlayerDetailDrawer player={selectedPlayer} onClose={() => setSelectedPlayer(undefined)} />
    </div>
  );
};
