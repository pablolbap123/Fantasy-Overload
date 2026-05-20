import { ArrowRightLeft, Eye, Lock, Save, Shuffle, Trash2, UserRoundPlus } from "lucide-react";
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
import { formationShape, validateLineup } from "../utils/calculatePoints";
import { formatMoney, positionTone } from "../utils/formatters";

const formations = Object.keys(formationShape) as Formation[];

const lineupForMatchday = (lineups: Lineup[], userId: string | null, matchdayId?: string) =>
  [...lineups]
    .filter((lineup) => lineup.userId === userId && (!matchdayId || lineup.matchdayId === matchdayId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

export const MyTeamPage = () => {
  const { currentLeague, userId, leaguePlayers, players, members, lineups, matchdays, submitLineup, sellPlayer } = useFantasy();
  const currentMatchdayNumber = currentLeague?.currentMatchday ?? matchdays.at(-1)?.number ?? 1;
  const [selectedMatchdayNumber, setSelectedMatchdayNumber] = useState(currentMatchdayNumber);
  const [formation, setFormation] = useState<Formation>("4-4-2");
  const [starterIds, setStarterIds] = useState<string[]>([]);
  const [benchIds, setBenchIds] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | undefined>();
  const [swapCandidate, setSwapCandidate] = useState<Player | undefined>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedMatchdayNumber(currentMatchdayNumber);
  }, [currentMatchdayNumber]);

  const myLeaguePlayers = useMemo(() => leaguePlayers.filter((item) => item.ownerUserId === userId), [leaguePlayers, userId]);
  const squad = useMemo(
    () =>
      myLeaguePlayers
        .map((item) => players.find((player) => player.id === item.playerId))
        .filter(Boolean)
        .sort((a, b) =>
          a!.position === b!.position
            ? b!.totalPoints - a!.totalPoints
            : formationShape["4-4-2"][a!.position] - formationShape["4-4-2"][b!.position],
        ) as Player[],
    [myLeaguePlayers, players],
  );

  const me = members.find((member) => member.userId === userId);
  const activeMatchday = matchdays.find((matchday) => matchday.number === selectedMatchdayNumber);
  const activeLineup = lineupForMatchday(lineups, userId, activeMatchday?.id);
  const currentMatchday = matchdays.find((matchday) => matchday.number === currentMatchdayNumber);
  const savedCurrentLineup = lineupForMatchday(lineups, userId, currentMatchday?.id);
  const isCurrentMatchday = selectedMatchdayNumber === currentMatchdayNumber;
  const isEditable = isCurrentMatchday && !currentLeague?.lineupsLocked;

  const availableMatchdayNumbers = useMemo(() => {
    const numbers = new Set<number>();
    matchdays.forEach((matchday) => {
      if (matchday.number <= currentMatchdayNumber) numbers.add(matchday.number);
    });
    lineups
      .filter((lineup) => lineup.userId === userId)
      .forEach((lineup) => {
        const found = matchdays.find((matchday) => matchday.id === lineup.matchdayId);
        if (found) numbers.add(found.number);
      });
    return [...numbers].sort((a, b) => a - b);
  }, [currentMatchdayNumber, lineups, matchdays, userId]);

  const starters = Array.from(new Set(starterIds))
    .map((id) => squad.find((player) => player.id === id))
    .filter(Boolean) as Player[];
  const starterSet = new Set(starters.map((player) => player.id));
  const bench = Array.from(new Set(benchIds))
    .filter((id) => !starterSet.has(id))
    .map((id) => squad.find((player) => player.id === id))
    .filter(Boolean) as Player[];

  const squadPointsFor = (matchdayNumber: number) =>
    squad.reduce((sum, player) => sum + Number(player.pointsByMatchday[matchdayNumber] ?? 0), 0);

  const selectedSquadPoints = squadPointsFor(selectedMatchdayNumber);

  useEffect(() => {
    if (activeLineup) {
      setFormation(activeLineup.formation);
      const nextStarters = Array.from(new Set(activeLineup.players.filter((player) => player.isStarter).map((player) => player.playerId)));
      setStarterIds(nextStarters);
      setBenchIds(
        Array.from(new Set(activeLineup.players.filter((player) => !player.isStarter).map((player) => player.playerId))).filter(
          (playerId) => !nextStarters.includes(playerId),
        ),
      );
      return;
    }

    if (!isCurrentMatchday) {
      setStarterIds([]);
      setBenchIds([]);
      return;
    }

    const startersByDefault = [
      ...squad.filter((player) => player.position === "POR").slice(0, 1),
      ...squad.filter((player) => player.position === "DEF").slice(0, 4),
      ...squad.filter((player) => player.position === "MED").slice(0, 4),
      ...squad.filter((player) => player.position === "DEL").slice(0, 2),
    ].map((player) => player.id);
    setFormation("4-4-2");
    setStarterIds(startersByDefault);
    setBenchIds(squad.filter((player) => !startersByDefault.includes(player.id)).map((player) => player.id));
  }, [activeLineup, isCurrentMatchday, squad]);

  const validation = useMemo(() => validateLineup(squad, starterIds, formation), [formation, squad, starterIds]);

  const moveToStarter = (playerId: string) => {
    if (!isEditable) return;
    const player = squad.find((item) => item.id === playerId);
    if (!player) return;
    const shape = formationShape[formation];
    const samePositionStarters = starters.filter((item) => item.position === player.position);
    if (samePositionStarters.length >= shape[player.position]) {
      setSwapCandidate(player);
      return;
    }
    setStarterIds((current) => (current.includes(playerId) ? current : [...current, playerId]));
    setBenchIds((current) => current.filter((id) => id !== playerId));
  };

  const replaceStarter = (benchPlayer: Player, starterPlayer: Player) => {
    setStarterIds((current) => current.map((id) => (id === starterPlayer.id ? benchPlayer.id : id)));
    setBenchIds((current) => current.filter((id) => id !== benchPlayer.id).concat(starterPlayer.id));
    setSwapCandidate(undefined);
  };

  const moveToBench = (playerId: string) => {
    if (!isEditable) return;
    setStarterIds((current) => current.filter((id) => id !== playerId));
    setBenchIds((current) => (current.includes(playerId) ? current : [...current, playerId]));
  };

  const autofill = () => {
    if (!isEditable) return;
    const shape = formationShape[formation];
    const startersByPoints = (Object.keys(shape) as Array<keyof typeof shape>).flatMap((position) =>
      squad
        .filter((player) => player.position === position && player.status !== "lesionado" && player.status !== "sancionado")
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, shape[position])
        .map((player) => player.id),
    );
    setStarterIds(startersByPoints);
    setBenchIds(squad.filter((player) => !startersByPoints.includes(player.id)).map((player) => player.id));
  };

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      await submitLineup(formation, starterIds, benchIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la alineacion.");
    } finally {
      setSaving(false);
    }
  };

  if (squad.length === 0) {
    return <EmptyState title="Tu plantilla esta vacia" description="Compra jugadores en el mercado para construir tu once." />;
  }

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
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Shuffle className="h-4 w-4" />} onClick={autofill} disabled={!isEditable}>
            Auto once
          </Button>
          <Button loading={saving} icon={<Save className="h-4 w-4" />} onClick={() => void save()} disabled={!isEditable}>
            Guardar
          </Button>
        </div>
      </div>

      <Card>
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
                  ? "border-[#62d7ff]/60 bg-[#62d7ff]/15 text-white"
                  : "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/10"
              }`}
              onClick={() => setSelectedMatchdayNumber(number)}
            >
              <div className="text-xs font-black uppercase text-slate-300">{number === currentMatchdayNumber ? "Actual" : "Historico"}</div>
              <div className="text-lg font-black">J{number}</div>
              <div className="text-sm font-black text-[#21d17f]">{squadPointsFor(number)} pts</div>
            </button>
          ))}
        </div>
      </Card>

      {currentLeague?.lineupsLocked ? (
        <div className="rounded-lg border border-[#f5bd43]/25 bg-[#f5bd43]/15 p-3 text-sm font-semibold text-[#ffe2a2]">
          La alineacion esta bloqueada porque la jornada esta en curso.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white">Once titular · J{selectedMatchdayNumber}</h2>
              <p className="text-sm font-black text-[#21d17f]">{selectedSquadPoints} puntos de plantilla</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {formations.map((item) => (
                <button
                  key={item}
                  className={`rounded-lg px-3 py-2 text-sm font-black transition ${
                    formation === item ? "bg-[#62d7ff] text-[#08101f]" : "bg-white/10 text-slate-100 hover:bg-white/15"
                  }`}
                  onClick={() => isEditable && setFormation(item)}
                  disabled={!isEditable}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {starters.length > 0 ? (
            <FormationBoard
              formation={formation}
              players={squad}
              starterIds={starterIds}
              onPlayerClick={moveToBench}
              onPlayerDetail={setSelectedPlayer}
              matchdayNumber={selectedMatchdayNumber}
              readOnly={!isEditable}
            />
          ) : (
            <EmptyState title="No hay once guardado" description="No existe alineacion para esta jornada." />
          )}
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
            {savedCurrentLineup ? <Badge className="bg-[#62d7ff]/20 text-[#c5f2ff] ring-[#62d7ff]/35">Guardada</Badge> : null}
          </div>
          {error ? <div className="mt-3 rounded-lg border border-[#ff3f55]/30 bg-[#ff3f55]/15 p-3 text-sm text-rose-100">{error}</div> : null}
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-base font-black text-white">Banquillo</h2>
            <div className="space-y-2">
              {bench.map((player) => (
                <div key={player.id} className="flex items-center gap-3 rounded-lg bg-[#202a43]/80 p-3">
                  <PlayerAvatar player={player} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-white">{player.name}</div>
                    <div className="truncate text-xs font-semibold text-slate-300">{player.teamName}</div>
                    <div className="mt-1 text-xs font-black text-[#f5bd43]">{formatMoney(player.currentPrice)}</div>
                  </div>
                  <div className="text-right">
                    <Badge className={positionTone[player.position]}>{player.position}</Badge>
                    <div className="mt-1 text-sm font-black text-[#21d17f]">{player.pointsByMatchday[selectedMatchdayNumber] ?? 0} pts</div>
                  </div>
                  <button className="rounded-lg p-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => setSelectedPlayer(player)} aria-label="Ver detalle">
                    <Eye className="h-4 w-4" />
                  </button>
                  {isEditable ? (
                    <>
                      <Button variant="secondary" icon={<UserRoundPlus className="h-4 w-4" />} onClick={() => moveToStarter(player.id)}>
                        Titular
                      </Button>
                      <button className="rounded-lg p-2 text-rose-200 hover:bg-rose-500/10" onClick={() => void sellPlayer(player.id)} aria-label="Vender">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-black text-white">Puntos de plantilla · J{selectedMatchdayNumber}</h2>
            <div className="space-y-2">
              {squad
                .sort((a, b) => (b.pointsByMatchday[selectedMatchdayNumber] ?? 0) - (a.pointsByMatchday[selectedMatchdayNumber] ?? 0))
                .map((player) => (
                  <button
                    key={player.id}
                    className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg bg-[#202a43]/80 p-3 text-left hover:bg-[#26314a]"
                    onClick={() => setSelectedPlayer(player)}
                  >
                    <PlayerAvatar player={player} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">{player.name}</div>
                      <div className="truncate text-xs font-semibold text-slate-300">{player.teamName}</div>
                    </div>
                    <div className="text-right text-lg font-black text-[#21d17f]">{player.pointsByMatchday[selectedMatchdayNumber] ?? 0}</div>
                  </button>
                ))}
            </div>
          </Card>
        </div>
      </div>

      {swapCandidate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur" onClick={() => setSwapCandidate(undefined)}>
          <Card className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-xl font-black text-white">Cambiar por titular</h2>
            <p className="mt-1 text-sm text-slate-300">
              Elige que {swapCandidate.position} sale del once para que entre {swapCandidate.name}.
            </p>
            <div className="mt-4 space-y-2">
              {starters
                .filter((player) => player.position === swapCandidate.position)
                .map((starter) => (
                  <button
                    key={starter.id}
                    className="flex w-full items-center gap-3 rounded-lg bg-[#202a43]/80 p-3 text-left hover:bg-[#26314a]"
                    onClick={() => replaceStarter(swapCandidate, starter)}
                  >
                    <PlayerAvatar player={starter} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-black text-white">{starter.name}</div>
                      <div className="text-xs text-slate-300">{starter.pointsByMatchday[selectedMatchdayNumber] ?? 0} pts en J{selectedMatchdayNumber}</div>
                    </div>
                    <ArrowRightLeft className="h-5 w-5 text-[#62d7ff]" />
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
