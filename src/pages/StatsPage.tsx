import { useMemo, useState } from "react";
import { RankingList } from "../components/stats/RankingList";
import { Card } from "../components/ui/Card";
import { useFantasy } from "../store/fantasyStore";
import { formatMoney } from "../utils/formatters";

export const StatsPage = () => {
  const { players, teams } = useFantasy();
  const [teamId, setTeamId] = useState("todos");
  const [position, setPosition] = useState("todos");
  const [matchday, setMatchday] = useState("temporada");

  const filtered = useMemo(
    () =>
      players.filter((player) => {
        const byTeam = teamId === "todos" || player.teamId === teamId;
        const byPosition = position === "todos" || player.position === position;
        return byTeam && byPosition;
      }),
    [players, position, teamId],
  );

  const revelation = [...filtered].sort((a, b) => b.fantasyValue / Math.max(b.currentPrice, 1) - a.fantasyValue / Math.max(a.currentPrice, 1));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Estadísticas</h1>
        <p className="mt-1 text-sm text-slate-400">Rankings globales y filtros por temporada, jornada, equipo y posición.</p>
      </div>
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <select className="field" value={matchday} onChange={(event) => setMatchday(event.target.value)}>
            <option value="temporada">Temporada</option>
            <option value="j1">Jornada 1</option>
            <option value="j2">Jornada 2</option>
            <option value="j3">Jornada 3</option>
          </select>
          <select className="field" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            <option value="todos">Todos los equipos</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <select className="field" value={position} onChange={(event) => setPosition(event.target.value)}>
            <option value="todos">Todas las posiciones</option>
            <option value="POR">Porteros</option>
            <option value="DEF">Defensas</option>
            <option value="MED">Medios</option>
            <option value="DEL">Delanteros</option>
          </select>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RankingList title="Máximos goleadores" items={[...filtered].sort((a, b) => b.stats.goals - a.stats.goals)} renderName={(p) => p.name} renderValue={(p) => p.stats.goals} />
        <RankingList title="Máximos asistentes" items={[...filtered].sort((a, b) => b.stats.assists - a.stats.assists)} renderName={(p) => p.name} renderValue={(p) => p.stats.assists} />
        <RankingList title="Más puntos fantasy" items={[...filtered].sort((a, b) => b.totalPoints - a.totalPoints)} renderName={(p) => p.name} renderValue={(p) => p.totalPoints} />
        <RankingList title="Mejores porteros" items={filtered.filter((p) => p.position === "POR").sort((a, b) => b.totalPoints - a.totalPoints)} renderName={(p) => p.name} renderValue={(p) => p.totalPoints} />
        <RankingList title="Mejores defensas" items={filtered.filter((p) => p.position === "DEF").sort((a, b) => b.totalPoints - a.totalPoints)} renderName={(p) => p.name} renderValue={(p) => p.totalPoints} />
        <RankingList title="Jugadores más caros" items={[...filtered].sort((a, b) => b.currentPrice - a.currentPrice)} renderName={(p) => p.name} renderValue={(p) => formatMoney(p.currentPrice)} />
        <RankingList title="Jugadores revelación" items={revelation} renderName={(p) => p.name} renderValue={(p) => p.fantasyValue} />
        <RankingList title="Más tarjetas" items={[...filtered].sort((a, b) => b.stats.yellowCards + b.stats.redCards * 2 - (a.stats.yellowCards + a.stats.redCards * 2))} renderName={(p) => p.name} renderValue={(p) => p.stats.yellowCards + p.stats.redCards} />
        <RankingList title="Mejor media" items={[...filtered].sort((a, b) => b.fantasyValue - a.fantasyValue)} renderName={(p) => p.name} renderValue={(p) => p.fantasyValue} />
      </div>
    </div>
  );
};
