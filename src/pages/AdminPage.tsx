import { useEffect, useMemo, useState } from "react";
import { Activity, Calculator, RotateCcw, Save, Search, ShieldAlert, SkipForward } from "lucide-react";
import type { Match, Player, PlayerMatchStats, PlayerPosition, PlayerStatus, ScoringRules } from "../types";
import { PlayerAvatar } from "../components/players/PlayerAvatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useFantasy } from "../store/fantasyStore";
import { calculatePlayerFantasyPoints, overloadRatingFromScore, playerPositions } from "../utils/calculatePoints";
import { getErrorMessage } from "../utils/errors";
import { positionTone, statusLabel, statusTone } from "../utils/formatters";
import { getPlayerTeamForMatchday } from "../data/transferOverrides";

const editableStatuses: PlayerStatus[] = ["disponible", "duda", "lesionado", "sancionado"];
const statusFilters: Array<"todos" | PlayerStatus> = ["todos", "lesionado", "sancionado", "duda", "disponible"];
const minimumAdminMatchdays = 13;

type EditableStats = {
  minutes: number;
  goals: number;
  assists: number;
  keyPasses: number;
  yellowCards: number;
  redCards: number;
  doubleYellowCards: number;
  ownGoals: number;
  penaltiesScored: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
  penaltiesProvoked: number;
  goalsConceded: number;
  cleanSheet: boolean;
  overloadScore: number;
  saves: number;
  shotsOnTarget: number;
  successfulDribbles: number;
  boxEntries: number;
  ballsLost: number;
  ballsRecovered: number;
  clearances: number;
};

const numericStatFields: Array<{
  key: keyof Omit<EditableStats, "cleanSheet">;
  label: string;
  positions?: PlayerPosition[];
  max?: number;
  step?: number;
}> = [
  { key: "minutes", label: "Minutos", max: 130 },
  { key: "goals", label: "Goles" },
  { key: "assists", label: "Asistencias de gol" },
  { key: "keyPasses", label: "Asistencias sin gol", positions: ["DEF", "MED", "DEL"] },
  { key: "shotsOnTarget", label: "Remates a puerta", positions: ["DEF", "MED", "DEL"] },
  { key: "successfulDribbles", label: "Regates logrados", positions: ["MED", "DEL"] },
  { key: "boxEntries", label: "Llegadas al area", positions: ["DEF", "MED", "DEL"] },
  { key: "saves", label: "Paradas", positions: ["POR"] },
  { key: "goalsConceded", label: "Goles recibidos" },
  { key: "ballsLost", label: "Balones perdidos", positions: ["DEF", "MED", "DEL"] },
  { key: "ballsRecovered", label: "Balones recuperados", positions: ["DEF", "MED"] },
  { key: "clearances", label: "Despejes", positions: ["POR", "DEF"] },
  { key: "penaltiesScored", label: "Penaltis marcados", positions: ["DEF", "MED", "DEL"] },
  { key: "penaltiesMissed", label: "Penaltis fallados" },
  { key: "penaltiesSaved", label: "Penaltis parados", positions: ["POR"] },
  { key: "penaltiesProvoked", label: "Penaltis provocados", positions: ["DEF", "MED", "DEL"] },
  { key: "yellowCards", label: "Amarillas" },
  { key: "doubleYellowCards", label: "Doble amarilla" },
  { key: "redCards", label: "Roja directa" },
  { key: "ownGoals", label: "Goles en propia" },
  { key: "overloadScore", label: "Nota Overload 0-10", max: 10, step: 0.1 },
];

const emptyStats: EditableStats = {
  minutes: 0,
  goals: 0,
  assists: 0,
  keyPasses: 0,
  yellowCards: 0,
  redCards: 0,
  doubleYellowCards: 0,
  ownGoals: 0,
  penaltiesScored: 0,
  penaltiesMissed: 0,
  penaltiesSaved: 0,
  penaltiesProvoked: 0,
  goalsConceded: 0,
  cleanSheet: false,
  overloadScore: 0,
  saves: 0,
  shotsOnTarget: 0,
  successfulDribbles: 0,
  boxEntries: 0,
  ballsLost: 0,
  ballsRecovered: 0,
  clearances: 0,
};

const isAbsenceStatus = (status: PlayerStatus) => status === "lesionado" || status === "sancionado";

const isClubPlayer = (player: Player) => {
  const team = `${player.teamId} ${player.teamName}`.toLowerCase();
  return !team.includes("bolsa");
};

const absenceText = (player: Player) => {
  if (!isAbsenceStatus(player.status)) return statusLabel[player.status];
  return `${statusLabel[player.status]}${player.unavailableUntilMatchday ? ` hasta J${player.unavailableUntilMatchday}` : ""}`;
};

const coerceNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const statFormFromMatchStat = (stat?: PlayerMatchStats, goalsConceded = 0): EditableStats => ({
  minutes: stat?.minutes ?? 0,
  goals: stat?.goals ?? 0,
  assists: stat?.assists ?? 0,
  keyPasses: stat?.keyPasses ?? 0,
  yellowCards: stat?.yellowCards ?? 0,
  redCards: stat?.redCards ?? 0,
  doubleYellowCards: stat?.doubleYellowCards ?? 0,
  ownGoals: stat?.ownGoals ?? 0,
  penaltiesScored: stat?.penaltiesScored ?? 0,
  penaltiesMissed: stat?.penaltiesMissed ?? 0,
  penaltiesSaved: stat?.penaltiesSaved ?? 0,
  penaltiesProvoked: stat?.penaltiesProvoked ?? 0,
  goalsConceded: stat?.goalsConceded ?? goalsConceded,
  cleanSheet: stat?.cleanSheet ?? false,
  overloadScore: stat?.overloadScore ?? ({ 4: 9, 3: 7, 2: 5, 1: 2.5, 0: 0 }[stat?.overloadRating ?? 0] ?? 0),
  saves: stat?.saves ?? 0,
  shotsOnTarget: stat?.shotsOnTarget ?? 0,
  successfulDribbles: stat?.successfulDribbles ?? 0,
  boxEntries: stat?.boxEntries ?? 0,
  ballsLost: stat?.ballsLost ?? 0,
  ballsRecovered: stat?.ballsRecovered ?? 0,
  clearances: stat?.clearances ?? 0,
});

const playerTeamIdForMatch = (player: Player, matchdayNumber: number) =>
  getPlayerTeamForMatchday(player.id, matchdayNumber, player.teamId, player.teamName).teamId;

const playerGoalsConcededFromScore = (player: Player, matchdayNumber: number, match?: Match, homeScore?: number, awayScore?: number) => {
  if (!match || homeScore === undefined || awayScore === undefined) return 0;
  return playerTeamIdForMatch(player, matchdayNumber) === match.homeTeamId ? awayScore : homeScore;
};

const buildStatsPayload = (
  match: Match,
  player: Player,
  form: EditableStats,
  homeScore: number,
  awayScore: number,
  scoringRules: ScoringRules,
  matchdayNumber: number,
  scoringPosition: PlayerPosition,
): PlayerMatchStats => {
  const teamIsHome = playerTeamIdForMatch(player, matchdayNumber) === match.homeTeamId;
  const teamWon = teamIsHome ? homeScore > awayScore : awayScore > homeScore;
  const teamLost = teamIsHome ? homeScore < awayScore : awayScore < homeScore;
  const overloadRating = overloadRatingFromScore(form.overloadScore) ?? 0;
  const validPositions = playerPositions(player);
  const effectiveScoringPosition = validPositions.includes(scoringPosition) ? scoringPosition : player.position;
  const base: PlayerMatchStats = {
    matchId: match.id,
    playerId: player.id,
    scoringPosition: effectiveScoringPosition,
    minutes: Math.max(0, Math.round(form.minutes)),
    goals: Math.max(0, Math.round(form.goals)),
    assists: Math.max(0, Math.round(form.assists)),
    keyPasses: Math.max(0, Math.round(form.keyPasses)),
    yellowCards: Math.max(0, Math.round(form.yellowCards)),
    redCards: Math.max(0, Math.round(form.redCards)),
    doubleYellowCards: Math.max(0, Math.round(form.doubleYellowCards)),
    ownGoals: Math.max(0, Math.round(form.ownGoals)),
    penaltiesScored: Math.max(0, Math.round(form.penaltiesScored)),
    penaltiesMissed: Math.max(0, Math.round(form.penaltiesMissed)),
    penaltiesSaved: Math.max(0, Math.round(form.penaltiesSaved)),
    penaltiesProvoked: Math.max(0, Math.round(form.penaltiesProvoked)),
    goalsConceded: Math.max(0, Math.round(form.goalsConceded)),
    cleanSheet: Boolean(form.cleanSheet),
    overloadScore: Math.max(0, Math.min(10, form.overloadScore)),
    overloadRating,
    mvp: false,
    teamWon,
    teamLost,
    highlighted: false,
    errorLedToGoal: false,
    saves: Math.max(0, Math.round(form.saves)),
    shotsOnTarget: Math.max(0, Math.round(form.shotsOnTarget)),
    successfulDribbles: Math.max(0, Math.round(form.successfulDribbles)),
    boxEntries: Math.max(0, Math.round(form.boxEntries)),
    ballsLost: Math.max(0, Math.round(form.ballsLost)),
    ballsRecovered: Math.max(0, Math.round(form.ballsRecovered)),
    clearances: Math.max(0, Math.round(form.clearances)),
    manualOverride: true,
  };

  return {
    ...base,
    fantasyPoints: calculatePlayerFantasyPoints(base, scoringRules, effectiveScoringPosition),
  };
};

export const AdminPage = () => {
  const {
    isOverloadAdmin,
    currentLeague,
    players,
    matchdays,
    scoringRules,
    updatePlayerAvailability,
    advanceLeagueMatchday,
    updateMatchResult,
  } = useFantasy();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | PlayerStatus>("todos");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [status, setStatus] = useState<PlayerStatus>("lesionado");
  const [untilMatchday, setUntilMatchday] = useState(currentLeague?.currentMatchday ?? 1);
  const [targetMatchday, setTargetMatchday] = useState(currentLeague?.currentMatchday ?? 1);
  const [selectedMatchdayNumber, setSelectedMatchdayNumber] = useState(currentLeague?.currentMatchday ?? 1);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [statsQuery, setStatsQuery] = useState("");
  const [selectedStatsPlayerId, setSelectedStatsPlayerId] = useState("");
  const [scoringPosition, setScoringPosition] = useState<PlayerPosition>("MED");
  const [statsForm, setStatsForm] = useState<EditableStats>(emptyStats);
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const currentMatchdayNumber = currentLeague?.currentMatchday ?? matchdays.at(-1)?.number ?? 1;
  const matchdayNumbers = useMemo(() => {
    const maxNumber = Math.max(
      minimumAdminMatchdays,
      currentLeague?.currentMatchday ?? 1,
      ...matchdays.map((matchday) => matchday.number),
    );
    return Array.from({ length: maxNumber }, (_, index) => index + 1);
  }, [currentLeague?.currentMatchday, matchdays]);
  const officialMatchdayNumbers = useMemo(() => new Set(matchdays.map((matchday) => matchday.number)), [matchdays]);
  const selectedMatchday = matchdays.find((matchday) => matchday.number === selectedMatchdayNumber) ?? matchdays[0];
  const selectedMatch = selectedMatchday?.matches.find((match) => match.id === selectedMatchId) ?? selectedMatchday?.matches[0];

  const clubPlayers = useMemo(() => players.filter(isClubPlayer), [players]);
  const matchPlayers = useMemo(() => {
    if (!selectedMatch) return [];
    const statPlayerIds = new Set(selectedMatch.playerStats.map((stat) => stat.playerId));
    return clubPlayers
      .filter((player) => {
        if (statPlayerIds.size > 0) return statPlayerIds.has(player.id);
        const { teamId } = getPlayerTeamForMatchday(player.id, selectedMatchdayNumber, player.teamId, player.teamName);
        return teamId === selectedMatch.homeTeamId || teamId === selectedMatch.awayTeamId;
      })
      .sort((a, b) => {
        const aTeam = getPlayerTeamForMatchday(a.id, selectedMatchdayNumber, a.teamId, a.teamName).teamName;
        const bTeam = getPlayerTeamForMatchday(b.id, selectedMatchdayNumber, b.teamId, b.teamName).teamName;
        return aTeam.localeCompare(bTeam) || a.position.localeCompare(b.position) || a.name.localeCompare(b.name);
      });
  }, [clubPlayers, selectedMatch, selectedMatchdayNumber]);

  const filteredMatchPlayers = useMemo(() => {
    const needle = statsQuery.trim().toLowerCase();
    return matchPlayers.filter((player) => `${player.name} ${player.teamName} ${playerPositions(player).join(" ")}`.toLowerCase().includes(needle));
  }, [matchPlayers, statsQuery]);
  const selectedStatsPlayer = matchPlayers.find((player) => player.id === selectedStatsPlayerId);
  const selectedStatsPlayerPositions = selectedStatsPlayer ? playerPositions(selectedStatsPlayer) : [];
  const selectedExistingStats = selectedMatch?.playerStats.find((stat) => stat.playerId === selectedStatsPlayerId);

  const filteredPlayers = useMemo(
    () =>
      players
        .filter((player) => {
          const text = `${player.name} ${player.teamName} ${player.position}`.toLowerCase();
          return text.includes(query.toLowerCase()) && (statusFilter === "todos" || player.status === statusFilter);
        })
        .sort((a, b) => {
          const aAbsence = isAbsenceStatus(a.status) ? 0 : 1;
          const bAbsence = isAbsenceStatus(b.status) ? 0 : 1;
          return aAbsence - bAbsence || a.name.localeCompare(b.name);
        })
        .slice(0, 90),
    [players, query, statusFilter],
  );

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId);
  const unavailableUntil = isAbsenceStatus(status) ? Math.max(currentMatchdayNumber, untilMatchday) : null;
  const absenceLength = unavailableUntil ? Math.max(1, unavailableUntil - currentMatchdayNumber + 1) : 0;
  const activeAbsences = players.filter((player) => isAbsenceStatus(player.status));
  const injuredCount = players.filter((player) => player.status === "lesionado").length;
  const sanctionedCount = players.filter((player) => player.status === "sancionado").length;
  const previewStats =
    selectedMatch && selectedStatsPlayer
      ? buildStatsPayload(selectedMatch, selectedStatsPlayer, statsForm, homeScore, awayScore, scoringRules, selectedMatchdayNumber, scoringPosition)
      : null;

  useEffect(() => {
    if (currentLeague?.currentMatchday) {
      setTargetMatchday(currentLeague.currentMatchday);
      setSelectedMatchdayNumber((current) => (current > 0 ? current : currentLeague.currentMatchday));
      setUntilMatchday((current) => Math.max(current, currentLeague.currentMatchday));
    }
  }, [currentLeague?.currentMatchday]);

  useEffect(() => {
    if (!selectedMatchday) return;
    if (selectedMatch && selectedMatchday.matches.some((match) => match.id === selectedMatch.id)) return;
    setSelectedMatchId(selectedMatchday.matches[0]?.id ?? "");
  }, [selectedMatch, selectedMatchday]);

  useEffect(() => {
    if (!selectedMatch) return;
    setHomeScore(coerceNumber(selectedMatch.homeScore));
    setAwayScore(coerceNumber(selectedMatch.awayScore));
  }, [selectedMatch]);

  useEffect(() => {
    if (selectedStatsPlayerId && filteredMatchPlayers.some((player) => player.id === selectedStatsPlayerId)) return;
    setSelectedStatsPlayerId(filteredMatchPlayers[0]?.id ?? "");
  }, [filteredMatchPlayers, selectedStatsPlayerId]);

  useEffect(() => {
    if (!selectedMatch || !selectedStatsPlayer) {
      setStatsForm(emptyStats);
      return;
    }
    const availablePositions = playerPositions(selectedStatsPlayer);
    setScoringPosition(
      selectedExistingStats?.scoringPosition && availablePositions.includes(selectedExistingStats.scoringPosition)
        ? selectedExistingStats.scoringPosition
        : selectedStatsPlayer.position,
    );
    // Usamos el marcador guardado en el partido (no el que el admin está editando en pantalla)
    // para no recargar el formulario cada vez que se cambia el score, lo que causaba que
    // la nota se "sumara" en vez de reemplazarse al volver a guardar.
    const savedHomeScore = coerceNumber(selectedMatch.homeScore);
    const savedAwayScore = coerceNumber(selectedMatch.awayScore);
    setStatsForm(
      statFormFromMatchStat(
        selectedExistingStats,
        playerGoalsConcededFromScore(selectedStatsPlayer, selectedMatchdayNumber, selectedMatch, savedHomeScore, savedAwayScore),
      ),
    );
    // Solo recargamos al cambiar de jugador o de partido, no al editar el marcador en pantalla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExistingStats, selectedMatch?.id, selectedMatchdayNumber, selectedStatsPlayer?.id]);

  useEffect(() => {
    if (selectedPlayerId && filteredPlayers.some((player) => player.id === selectedPlayerId)) return;
    const firstPlayer = filteredPlayers[0];
    if (firstPlayer) setSelectedPlayerId(firstPlayer.id);
  }, [filteredPlayers, selectedPlayerId]);

  useEffect(() => {
    if (!selectedPlayer) return;
    setStatus(selectedPlayer.status);
    setUntilMatchday(Math.max(currentMatchdayNumber, selectedPlayer.unavailableUntilMatchday ?? currentMatchdayNumber));
  }, [currentMatchdayNumber, selectedPlayer]);

  const updateNumericStat = (key: keyof Omit<EditableStats, "cleanSheet">, value: string) => {
    setStatsForm((current) => ({ ...current, [key]: Math.max(0, coerceNumber(value)) }));
  };

  const savePlayerStats = async () => {
    if (!selectedMatch || !selectedStatsPlayer) return;
    setMessage("");
    setSavingKey("stats");
    try {
      const nextStat = buildStatsPayload(selectedMatch, selectedStatsPlayer, statsForm, homeScore, awayScore, scoringRules, selectedMatchdayNumber, scoringPosition);
      const updatedMatch: Match = {
        ...selectedMatch,
        homeScore,
        awayScore,
        status: "finalizada",
        playedAt: selectedMatch.playedAt ?? new Date().toISOString(),
        playerStats: [...selectedMatch.playerStats.filter((stat) => stat.playerId !== selectedStatsPlayer.id), nextStat],
      };
      await updateMatchResult(updatedMatch);
      setStatsForm(statFormFromMatchStat(nextStat, nextStat.goalsConceded));
      setMessageTone("success");
      setMessage(`${selectedStatsPlayer.name}: ${nextStat.fantasyPoints ?? 0} puntos guardados.`);
    } catch (err) {
      setMessageTone("error");
      setMessage(getErrorMessage(err, "No se pudo guardar la puntuacion."));
    } finally {
      setSavingKey("");
    }
  };

  const saveAvailability = async () => {
    if (!selectedPlayer) return;
    setMessage("");
    setSavingKey("availability");
    try {
      await updatePlayerAvailability(selectedPlayer.id, status, unavailableUntil);
      setMessageTone("success");
      setMessage(`${selectedPlayer.name} actualizado: ${statusLabel[status]}${unavailableUntil ? ` hasta J${unavailableUntil}` : ""}.`);
    } catch (err) {
      setMessageTone("error");
      setMessage(getErrorMessage(err, "No se pudo actualizar el jugador."));
    } finally {
      setSavingKey("");
    }
  };

  const clearAvailability = async () => {
    if (!selectedPlayer) return;
    setMessage("");
    setSavingKey("clear");
    try {
      await updatePlayerAvailability(selectedPlayer.id, "disponible", null);
      setStatus("disponible");
      setMessageTone("success");
      setMessage(`${selectedPlayer.name} vuelve a estar disponible.`);
    } catch (err) {
      setMessageTone("error");
      setMessage(getErrorMessage(err, "No se pudo limpiar el estado."));
    } finally {
      setSavingKey("");
    }
  };

  const advance = async () => {
    setMessage("");
    setSavingKey("matchday");
    try {
      await advanceLeagueMatchday(targetMatchday);
      setMessageTone("success");
      setMessage(`Jornada actual actualizada a J${targetMatchday}.`);
    } catch (err) {
      setMessageTone("error");
      setMessage(getErrorMessage(err, "No se pudo avanzar la jornada."));
    } finally {
      setSavingKey("");
    }
  };

  if (!isOverloadAdmin) {
    return <EmptyState title="Panel no disponible" description="Este apartado solo esta habilitado para el administrador Overload." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Panel Overload</h1>
        <p className="mt-1 text-sm text-slate-400">Puntuaciones oficiales, disponibilidad de jugadores y jornada actual.</p>
      </div>

      <Card className="overflow-hidden border-[#62d7ff]/20 bg-gradient-to-br from-[#17233f] via-[#10182c] to-[#07101f]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#62d7ff]">
              <Calculator className="h-4 w-4" />
              Puntuaciones de partido
            </div>
            <h2 className="mt-1 text-lg font-black text-white">Editar puntos de jugadores</h2>
            <p className="mt-1 text-sm text-slate-400">Solo aparecen jugadores de clubes, nunca de la Bolsa.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-right">
            <div className="text-xs font-bold uppercase text-slate-400">Vista previa</div>
            <div className="text-3xl font-black text-[#65e0a3]">{previewStats?.fantasyPoints ?? 0}</div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[11rem_1fr_13rem_13rem]">
          <label>
            <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Jornada</span>
            <select className="field" value={selectedMatchdayNumber} onChange={(event) => setSelectedMatchdayNumber(Number(event.target.value))}>
              {matchdayNumbers.map((matchdayNumber) => (
                <option key={matchdayNumber} value={matchdayNumber}>
                  Jornada {matchdayNumber}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Partido</span>
            <select className="field" value={selectedMatch?.id ?? ""} onChange={(event) => setSelectedMatchId(event.target.value)}>
              {(selectedMatchday?.matches ?? []).map((match) => (
                <option key={match.id} value={match.id}>
                  {match.homeTeamName} - {match.awayTeamName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Local</span>
            <input className="field" type="number" min={0} value={homeScore} onChange={(event) => setHomeScore(coerceNumber(event.target.value))} />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Visitante</span>
            <input className="field" type="number" min={0} value={awayScore} onChange={(event) => setAwayScore(coerceNumber(event.target.value))} />
          </label>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(16rem,.8fr)_1.2fr]">
          <div>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input className="field pl-9" value={statsQuery} onChange={(event) => setStatsQuery(event.target.value)} placeholder="Buscar en el partido" />
            </div>
            <div className="thin-scrollbar max-h-[30rem] space-y-2 overflow-y-auto pr-1">
              {filteredMatchPlayers.map((player) => (
                <button
                  key={player.id}
                  className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selectedStatsPlayer?.id === player.id ? "border-[#65e0a3]/50 bg-[#65e0a3]/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                  onClick={() => setSelectedStatsPlayerId(player.id)}
                >
                  <PlayerAvatar player={player} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{player.name}</div>
                    <div className="truncate text-xs text-slate-400">{player.teamName}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {playerPositions(player).map((position) => (
                      <Badge key={position} className={positionTone[position]}>{position}</Badge>
                    ))}
                  </div>
                </button>
              ))}
              {filteredMatchPlayers.length === 0 ? <p className="p-3 text-sm text-slate-400">No hay jugadores de equipos para este partido.</p> : null}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0b1327]/70 p-4">
            <div className="mb-4 flex items-center gap-3">
              {selectedStatsPlayer ? <PlayerAvatar player={selectedStatsPlayer} size="sm" /> : <Activity className="h-8 w-8 text-slate-400" />}
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black text-white">{selectedStatsPlayer?.name ?? "Selecciona jugador"}</h3>
                <p className="truncate text-sm text-slate-400">{selectedStatsPlayer?.teamName ?? "Sin jugador seleccionado"}</p>
              </div>
              {selectedStatsPlayer ? (
                <label className="ml-auto min-w-32">
                  <span className="sr-only">Puntua como</span>
                  <select className="field h-10 py-1 text-sm" value={scoringPosition} onChange={(event) => setScoringPosition(event.target.value as PlayerPosition)}>
                    {selectedStatsPlayerPositions.map((position) => (
                      <option key={position} value={position}>
                        Puntua como {position}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {numericStatFields
                .filter((field) => !field.positions || field.positions.some((position) => selectedStatsPlayerPositions.includes(position)))
                .map((field) => (
                  <label key={field.key}>
                    <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{field.label}</span>
                    <input
                      className="field"
                      type="number"
                      min={0}
                      max={field.max}
                      step={field.step ?? 1}
                      value={statsForm[field.key]}
                      onChange={(event) => updateNumericStat(field.key, event.target.value)}
                    />
                  </label>
                ))}
            </div>

            <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <span>
                <span className="block text-sm font-black text-white">Porteria a cero</span>
                <span className="block text-xs text-slate-400">Solo suma si el jugador supera 60 minutos.</span>
              </span>
              <input
                className="h-5 w-5 accent-[#65e0a3]"
                type="checkbox"
                checked={statsForm.cleanSheet}
                onChange={(event) => setStatsForm((current) => ({ ...current, cleanSheet: event.target.checked }))}
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-300">
                Nota Overload: <span className="font-black text-white">{overloadRatingFromScore(statsForm.overloadScore) ?? 0}</span> puntos extra
              </div>
              <Button loading={savingKey === "stats"} icon={<Save className="h-4 w-4" />} onClick={() => void savePlayerStats()} disabled={!selectedStatsPlayer || !selectedMatch}>
                Guardar puntos
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase text-slate-400">Bajas activas</div>
              <div className="mt-1 text-2xl font-black text-white">{activeAbsences.length}</div>
            </div>
            <ShieldAlert className="h-6 w-6 text-[#ff3f55]" />
          </div>
        </Card>
        <Card>
          <div className="text-xs font-black uppercase text-slate-400">Lesionados</div>
          <div className="mt-1 text-2xl font-black text-rose-200">{injuredCount}</div>
        </Card>
        <Card>
          <div className="text-xs font-black uppercase text-slate-400">Sancionados</div>
          <div className="mt-1 text-2xl font-black text-[#f5bd43]">{sanctionedCount}</div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_.85fr]">
        <Card>
          <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Buscar jugador</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className="field pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, equipo o posicion" />
              </div>
            </label>
            <select className="field lg:w-52" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "todos" | PlayerStatus)}>
              {statusFilters.map((item) => (
                <option key={item} value={item}>
                  {item === "todos" ? "Todos estados" : statusLabel[item]}
                </option>
              ))}
            </select>
          </div>

          <div className="thin-scrollbar max-h-[34rem] space-y-2 overflow-y-auto pr-1">
            {filteredPlayers.map((player) => (
              <button
                key={player.id}
                className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border p-3 text-left transition ${
                  selectedPlayer?.id === player.id ? "border-[#62d7ff]/45 bg-[#62d7ff]/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
                onClick={() => setSelectedPlayerId(player.id)}
              >
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{player.name}</div>
                  <div className="truncate text-xs text-slate-400">{player.teamName}</div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">{absenceText(player)}</div>
                </div>
                <div className="text-right">
                  <Badge className={positionTone[player.position]}>{player.position}</Badge>
                  <Badge className={`${statusTone[player.status]} mt-1`}>{statusLabel[player.status]}</Badge>
                </div>
              </button>
            ))}
            {filteredPlayers.length === 0 ? <p className="p-3 text-sm text-slate-400">No hay jugadores con ese filtro.</p> : null}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              {selectedPlayer ? <PlayerAvatar player={selectedPlayer} size="sm" /> : <Activity className="h-8 w-8 text-slate-400" />}
              <div className="min-w-0">
                <h2 className="truncate text-base font-black text-white">{selectedPlayer?.name ?? "Selecciona jugador"}</h2>
                <p className="truncate text-sm text-slate-400">{selectedPlayer?.teamName ?? "Sin jugador seleccionado"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {editableStatuses.map((item) => (
                <button
                  key={item}
                  className={`rounded-lg border px-3 py-2 text-sm font-black transition ${
                    status === item ? "border-[#62d7ff]/55 bg-[#62d7ff]/15 text-white" : "border-white/10 bg-white/[0.04] text-slate-200"
                  }`}
                  onClick={() => {
                    setStatus(item);
                    if (isAbsenceStatus(item)) setUntilMatchday((current) => Math.max(current, currentMatchdayNumber));
                  }}
                >
                  {statusLabel[item]}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Hasta jornada incluida</span>
              <select className="field" value={untilMatchday} disabled={!isAbsenceStatus(status)} onChange={(event) => setUntilMatchday(Number(event.target.value))}>
                {matchdayNumbers.map((matchdayNumber) => (
                  <option key={matchdayNumber} value={matchdayNumber}>
                    J{matchdayNumber}
                    {officialMatchdayNumbers.has(matchdayNumber) ? "" : " - pendiente"}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 rounded-lg border border-white/10 bg-[#202a43]/65 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                <Badge className={statusTone[status]}>{statusLabel[status]}</Badge>
                {unavailableUntil ? (
                  <>
                    <span>No puntuara hasta J{unavailableUntil} incluida</span>
                    <span className="text-slate-400">({absenceLength} jornada{absenceLength === 1 ? "" : "s"})</span>
                  </>
                ) : (
                  <span className="text-slate-300">Puede puntuar con normalidad</span>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button loading={savingKey === "availability"} icon={<Save className="h-4 w-4" />} onClick={() => void saveAvailability()} disabled={!selectedPlayer}>
                Guardar estado
              </Button>
              <Button variant="secondary" loading={savingKey === "clear"} icon={<RotateCcw className="h-4 w-4" />} onClick={() => void clearAvailability()} disabled={!selectedPlayer}>
                Marcar disponible
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-black text-white">Jornada actual</h2>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <select className="field" value={targetMatchday} onChange={(event) => setTargetMatchday(Number(event.target.value))}>
                {matchdayNumbers.map((matchdayNumber) => (
                  <option key={matchdayNumber} value={matchdayNumber}>
                    Jornada {matchdayNumber}
                    {officialMatchdayNumbers.has(matchdayNumber) ? "" : " - pendiente"}
                  </option>
                ))}
              </select>
              <Button loading={savingKey === "matchday"} icon={<SkipForward className="h-4 w-4" />} onClick={() => void advance()}>
                Aplicar
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-black text-white">Bajas activas</h2>
            <div className="thin-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
              {activeAbsences.map((player) => (
                <button
                  key={player.id}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
                  onClick={() => {
                    setSelectedPlayerId(player.id);
                    setStatus(player.status);
                    setUntilMatchday(Math.max(currentMatchdayNumber, player.unavailableUntilMatchday ?? currentMatchdayNumber));
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{player.name}</div>
                    <div className="truncate text-xs text-slate-400">{absenceText(player)}</div>
                  </div>
                  <Badge className={statusTone[player.status]}>{statusLabel[player.status]}</Badge>
                </button>
              ))}
              {activeAbsences.length === 0 ? <p className="text-sm text-slate-400">No hay bajas activas.</p> : null}
            </div>
          </Card>

          {message ? (
            <div
              className={`rounded-lg border p-3 text-sm font-bold ${
                messageTone === "error"
                  ? "border-rose-300/25 bg-rose-500/10 text-rose-100"
                  : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
