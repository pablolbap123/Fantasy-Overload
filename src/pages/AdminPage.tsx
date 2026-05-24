import { useEffect, useMemo, useState } from "react";
import { Activity, RotateCcw, Save, Search, ShieldAlert, SkipForward } from "lucide-react";
import type { Player, PlayerStatus } from "../types";
import { PlayerAvatar } from "../components/players/PlayerAvatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useFantasy } from "../store/fantasyStore";
import { getErrorMessage } from "../utils/errors";
import { positionTone, statusLabel, statusTone } from "../utils/formatters";

const editableStatuses: PlayerStatus[] = ["disponible", "duda", "lesionado", "sancionado"];
const statusFilters: Array<"todos" | PlayerStatus> = ["todos", "lesionado", "sancionado", "duda", "disponible"];
const minimumAdminMatchdays = 13;

const isAbsenceStatus = (status: PlayerStatus) => status === "lesionado" || status === "sancionado";

const absenceText = (player: Player) => {
  if (!isAbsenceStatus(player.status)) return statusLabel[player.status];
  return `${statusLabel[player.status]}${player.unavailableUntilMatchday ? ` hasta J${player.unavailableUntilMatchday}` : ""}`;
};

export const AdminPage = () => {
  const { isOverloadAdmin, currentLeague, players, matchdays, updatePlayerAvailability, advanceLeagueMatchday } = useFantasy();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | PlayerStatus>("todos");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [status, setStatus] = useState<PlayerStatus>("lesionado");
  const [untilMatchday, setUntilMatchday] = useState(currentLeague?.currentMatchday ?? 1);
  const [targetMatchday, setTargetMatchday] = useState(currentLeague?.currentMatchday ?? 1);
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

  useEffect(() => {
    if (currentLeague?.currentMatchday) {
      setTargetMatchday(currentLeague.currentMatchday);
      setUntilMatchday((current) => Math.max(current, currentLeague.currentMatchday));
    }
  }, [currentLeague?.currentMatchday]);

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
        <p className="mt-1 text-sm text-slate-400">Disponibilidad de jugadores, sanciones, lesiones y jornada actual.</p>
      </div>

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
              <select
                className="field"
                value={untilMatchday}
                disabled={!isAbsenceStatus(status)}
                onChange={(event) => setUntilMatchday(Number(event.target.value))}
              >
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
