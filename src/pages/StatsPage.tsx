import { useMemo, useState } from "react";
import { RankingList } from "../components/stats/RankingList";
import { Card } from "../components/ui/Card";
import { useFantasy } from "../store/fantasyStore";
import { formatMoney } from "../utils/formatters";
import { playerMatchdayPoints } from "../utils/playerAvailability";

export const StatsPage = () => {
  const { players, teams, matchdays } = useFantasy();
  const [teamId, setTeamId] = useState("todos");
  const [position, setPosition] = useState("todos");
  const [matchday, setMatchday] = useState("temporada");
  const selectedMatchdayNumber = matchday === "temporada" ? null : Number(matchday);

  const filtered = useMemo(
    () =>
      players.filter((player) => {
        const byTeam = teamId === "todos" || player.teamId === teamId;
        const byPosition = position === "todos" || player.position === position || player.positions?.includes(position as typeof player.position);
        return byTeam && byPosition;
      }),
    [players, position, teamId],
  );

  const matchdayStats = useMemo(() => {
    const stats = new Map<string, { goals: number; assists: number; cards: number; points: number }>();
    if (!selectedMatchdayNumber) return stats;
    const selected = matchdays.find((item) => item.number === selectedMatchdayNumber);
    selected?.matches.forEach((match) => {
      match.playerStats.forEach((stat) => {
        const current = stats.get(stat.playerId) ?? { goals: 0, assists: 0, cards: 0, points: 0 };
        current.goals += stat.goals;
        current.assists += stat.assists;
        current.cards += stat.yellowCards + stat.redCards;
        current.points += stat.fantasyPoints ?? 0;
        stats.set(stat.playerId, current);
      });
    });
    return stats;
  }, [matchdays, selectedMatchdayNumber]);

  const rows = useMemo(
    () =>
      filtered.map((player) => {
        const stat = matchdayStats.get(player.id);
        const fantasyPoints = selectedMatchdayNumber ? playerMatchdayPoints(player, selectedMatchdayNumber) : player.totalPoints;
        return {
          player,
          fantasyPoints,
          goals: selectedMatchdayNumber ? stat?.goals ?? 0 : player.stats.goals,
          assists: selectedMatchdayNumber ? stat?.assists ?? 0 : player.stats.assists,
          cards: selectedMatchdayNumber ? stat?.cards ?? 0 : player.stats.yellowCards + player.stats.redCards,
        };
      }),
    [filtered, matchdayStats, selectedMatchdayNumber],
  );

  const revelation = [...rows].sort((a, b) => b.fantasyPoints / Math.max(b.player.currentPrice, 1) - a.fantasyPoints / Math.max(a.player.currentPrice, 1));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Estadisticas</h1>
        <p className="mt-1 text-sm text-slate-400">Rankings globales y filtros por temporada, jornada, equipo y posicion.</p>
      </div>
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <select className="field" value={matchday} onChange={(event) => setMatchday(event.target.value)}>
            <option value="temporada">Temporada</option>
            {matchdays.map((item) => (
              <option key={item.id} value={item.number}>
                Jornada {item.number}
              </option>
            ))}
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
        <RankingList title="Maximos goleadores" items={[...rows].sort((a, b) => b.goals - a.goals)} renderName={(row) => row.player.name} renderValue={(row) => row.goals} />
        <RankingList title="Maximos asistentes" items={[...rows].sort((a, b) => b.assists - a.assists)} renderName={(row) => row.player.name} renderValue={(row) => row.assists} />
        <RankingList title="Mas puntos fantasy" items={[...rows].sort((a, b) => b.fantasyPoints - a.fantasyPoints)} renderName={(row) => row.player.name} renderValue={(row) => row.fantasyPoints} />
        <RankingList title="Mejores porteros" items={rows.filter((row) => row.player.position === "POR").sort((a, b) => b.fantasyPoints - a.fantasyPoints)} renderName={(row) => row.player.name} renderValue={(row) => row.fantasyPoints} />
        <RankingList title="Mejores defensas" items={rows.filter((row) => row.player.position === "DEF").sort((a, b) => b.fantasyPoints - a.fantasyPoints)} renderName={(row) => row.player.name} renderValue={(row) => row.fantasyPoints} />
        <RankingList title="Jugadores mas caros" items={[...rows].sort((a, b) => b.player.currentPrice - a.player.currentPrice)} renderName={(row) => row.player.name} renderValue={(row) => formatMoney(row.player.currentPrice)} />
        <RankingList title="Jugadores revelacion" items={revelation} renderName={(row) => row.player.name} renderValue={(row) => row.fantasyPoints} />
        <RankingList title="Mas tarjetas" items={[...rows].sort((a, b) => b.cards - a.cards)} renderName={(row) => row.player.name} renderValue={(row) => row.cards} />
        <RankingList
          title="Mejor media"
          items={[...rows].sort((a, b) => (selectedMatchdayNumber ? b.fantasyPoints - a.fantasyPoints : b.player.fantasyValue - a.player.fantasyValue))}
          renderName={(row) => row.player.name}
          renderValue={(row) => (selectedMatchdayNumber ? row.fantasyPoints : row.player.fantasyValue)}
        />
      </div>
    </div>
  );
};
