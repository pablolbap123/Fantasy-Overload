import { useEffect, useMemo, useState } from "react";
import { Save, SkipForward } from "lucide-react";
import type { PlayerStatus } from "../types";
import { PlayerAvatar } from "../components/players/PlayerAvatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useFantasy } from "../store/fantasyStore";
import { getErrorMessage } from "../utils/errors";
import { positionTone, statusLabel, statusTone } from "../utils/formatters";

const editableStatuses: PlayerStatus[] = ["disponible", "duda", "lesionado", "sancionado"];
const minimumAdminMatchdays = 13;

export const AdminPage = () => {
  const { isOverloadAdmin, currentLeague, players, matchdays, updatePlayerAvailability, advanceLeagueMatchday } = useFantasy();
  const [query, setQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [status, setStatus] = useState<PlayerStatus>("lesionado");
  const [remaining, setRemaining] = useState(1);
  const [targetMatchday, setTargetMatchday] = useState(currentLeague?.currentMatchday ?? 6);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const filteredPlayers = useMemo(
    () =>
      players
        .filter((player) => `${player.name} ${player.teamName}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 60),
    [players, query],
  );

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? filteredPlayers[0];
  const currentMatchdayNumber = currentLeague?.currentMatchday ?? matchdays.at(-1)?.number ?? 6;
  const unavailableUntil = status === "lesionado" || status === "sancionado" ? currentMatchdayNumber + Math.max(0, remaining - 1) : null;
  const matchdayNumbers = useMemo(() => {
    const maxNumber = Math.max(
      minimumAdminMatchdays,
      currentLeague?.currentMatchday ?? 1,
      ...matchdays.map((matchday) => matchday.number),
    );
    return Array.from({ length: maxNumber }, (_, index) => index + 1);
  }, [currentLeague?.currentMatchday, matchdays]);
  const officialMatchdayNumbers = useMemo(() => new Set(matchdays.map((matchday) => matchday.number)), [matchdays]);

  useEffect(() => {
    if (currentLeague?.currentMatchday) setTargetMatchday(currentLeague.currentMatchday);
  }, [currentLeague?.currentMatchday]);

  const saveAvailability = async () => {
    if (!selectedPlayer) return;
    setMessage("");
    setSaving(true);
    try {
      await updatePlayerAvailability(selectedPlayer.id, status, unavailableUntil);
      setMessage(`${selectedPlayer.name} actualizado: ${status}${unavailableUntil ? ` hasta J${unavailableUntil}` : ""}.`);
    } catch (err) {
      setMessage(getErrorMessage(err, "No se pudo actualizar el jugador."));
    } finally {
      setSaving(false);
    }
  };

  const advance = async () => {
    setMessage("");
    setSaving(true);
    try {
      await advanceLeagueMatchday(targetMatchday);
      setMessage(`Jornada actual actualizada a J${targetMatchday}.`);
    } catch (err) {
      setMessage(getErrorMessage(err, "No se pudo avanzar la jornada."));
    } finally {
      setSaving(false);
    }
  };

  if (!isOverloadAdmin) {
    return <EmptyState title="Panel no disponible" description="Este apartado solo esta habilitado para el administrador Overload." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Panel Overload</h1>
        <p className="mt-1 text-sm text-slate-400">Gestiona lesiones, sanciones y la jornada actual sin simular partidos.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <h2 className="mb-3 text-base font-black text-white">Disponibilidad de jugadores</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_.7fr_.45fr]">
            <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jugador o equipo" />
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value as PlayerStatus)}>
              {editableStatuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabel[item]}
                </option>
              ))}
            </select>
            <input
              className="field"
              type="number"
              min={1}
              max={20}
              value={remaining}
              disabled={status !== "lesionado" && status !== "sancionado"}
              onChange={(event) => setRemaining(Number(event.target.value))}
              aria-label="Jornadas restantes"
            />
          </div>
          <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {filteredPlayers.map((player) => (
              <button
                key={player.id}
                className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border p-3 text-left transition ${
                  selectedPlayer?.id === player.id ? "border-[#62d7ff]/45 bg-[#62d7ff]/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
                onClick={() => {
                  setSelectedPlayerId(player.id);
                  setStatus(player.status);
                  setRemaining(Math.max(1, (player.unavailableUntilMatchday ?? currentMatchdayNumber) - currentMatchdayNumber + 1));
                }}
              >
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{player.name}</div>
                  <div className="truncate text-xs text-slate-400">{player.teamName}</div>
                </div>
                <div className="text-right">
                  <Badge className={positionTone[player.position]}>{player.position}</Badge>
                  <Badge className={`${statusTone[player.status]} mt-1`}>{statusLabel[player.status]}</Badge>
                  {player.unavailableUntilMatchday ? <div className="mt-1 text-[11px] font-bold text-rose-200">hasta J{player.unavailableUntilMatchday}</div> : null}
                </div>
              </button>
            ))}
          </div>
          <Button className="mt-4 w-full" loading={saving} icon={<Save className="h-4 w-4" />} onClick={() => void saveAvailability()}>
            Guardar estado de {selectedPlayer?.name ?? "jugador"}
          </Button>
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-base font-black text-white">Jornada actual</h2>
            <p className="text-sm text-slate-400">Usalo cuando Challenge ya tenga datos oficiales y quieras mover la liga a la siguiente jornada.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <select className="field" value={targetMatchday} onChange={(event) => setTargetMatchday(Number(event.target.value))}>
                {matchdayNumbers.map((matchdayNumber) => (
                  <option key={matchdayNumber} value={matchdayNumber}>
                    Jornada {matchdayNumber}
                    {officialMatchdayNumbers.has(matchdayNumber) ? "" : " - pendiente"}
                  </option>
                ))}
              </select>
              <Button loading={saving} icon={<SkipForward className="h-4 w-4" />} onClick={() => void advance()}>
                Avanzar
              </Button>
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-base font-black text-white">Regla aplicada</h2>
            <p className="text-sm text-slate-300">
              Lesionados y sancionados no suman puntos fantasy hasta la jornada marcada. La estadistica oficial del jugador se conserva, pero el manager recibe 0 mientras dure la baja.
            </p>
          </Card>
          {message ? <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3 text-sm font-bold text-white">{message}</div> : null}
        </div>
      </div>
    </div>
  );
};
