import { CalendarDays, Coins, ShieldCheck, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { ActivityFeed } from "../components/fantasy/ActivityFeed";
import { InviteLeagueCard } from "../components/fantasy/InviteLeagueCard";
import { PlayerCard } from "../components/players/PlayerCard";
import { PlayerDetailDrawer } from "../components/players/PlayerDetailDrawer";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { useFantasy } from "../store/fantasyStore";
import { formatMoney } from "../utils/formatters";

const quickLinks = [
  ["Mi equipo", "team"],
  ["Mercado", "market"],
  ["Clasificación", "standings"],
  ["Jornada", "matchday"],
  ["Estadísticas", "stats"],
  ["Reglas", "settings"],
  ["Admin resultados", "admin"],
];

export const HomePage = () => {
  const { currentLeague, members, standings, userId, leaguePlayers, players, teams, matchdays, activities } = useFantasy();
  const [selectedPlayer, setSelectedPlayer] = useState<(typeof players)[number] | undefined>();
  const me = members.find((member) => member.userId === userId);
  const myPlayerIds = leaguePlayers.filter((item) => item.ownerUserId === userId).map((item) => item.playerId);
  const myPlayers = myPlayerIds.map((id) => players.find((player) => player.id === id)).filter(Boolean).sort((a, b) => b!.totalPoints - a!.totalPoints);
  const currentMatchday = matchdays.find((matchday) => matchday.number === currentLeague?.currentMatchday) ?? matchdays[0];
  const nextMatch = currentMatchday?.matches[0];
  const myStanding = standings.find((standing) => standing.userId === userId);
  const starters = myPlayers.slice(0, 11);
  const bench = myPlayers.slice(11);
  const unavailable = myPlayers.filter((player) => player?.status === "lesionado" || player?.status === "sancionado");

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <Card className="overflow-hidden p-0">
          <div className="relative p-5 sm:p-6">
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,rgba(56,189,248,.45),transparent_45%),linear-gradient(45deg,rgba(52,211,153,.3),transparent_55%)]" />
            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-wide text-sky-200">Overload Series Simulación</p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Fantasy Manager Online</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Jornada {currentLeague?.currentMatchday ?? 1}, {players.length} jugadores Challenge, {teams.length} equipos y
                clasificación de amigos en tiempo real.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {quickLinks.map(([label, path]) => (
                  <Link key={path} to={`../${path}`}>
                    <Button variant={path === "market" ? "primary" : "secondary"}>{label}</Button>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-black text-white">Partido destacado</h2>
          {nextMatch ? (
            <div className="mt-4 rounded-2xl bg-white/[0.04] p-4">
              <div className="text-sm font-semibold text-slate-300">Jornada {currentMatchday.number}</div>
              <div className="mt-2 flex items-center justify-between gap-3 text-lg font-black text-white">
                <span>{nextMatch.homeTeamName}</span>
                <span className="text-sky-200">
                  {nextMatch.status === "finalizada" ? `${nextMatch.homeScore ?? 0}-${nextMatch.awayScore ?? 0}` : "vs"}
                </span>
                <span className="text-right">{nextMatch.awayTeamName}</span>
              </div>
              <div className="mt-3 text-xs text-slate-500">Estado: {currentMatchday.status}</div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No hay partidos programados.</p>
          )}
        </Card>
      </section>

      <InviteLeagueCard league={currentLeague} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Puntos fantasy" value={me?.totalPoints ?? 0} icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Posición" value={`#${myStanding?.position ?? "-"}`} icon={<Trophy className="h-5 w-5" />} />
        <StatCard label="Presupuesto" value={formatMoney(me?.budget ?? 0)} icon={<Coins className="h-5 w-5" />} />
        <StatCard label="Participantes" value={members.length} icon={<Users className="h-5 w-5" />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_.8fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white">Resumen de plantilla</h2>
              <p className="text-sm text-slate-400">
                Titulares {Math.min(starters.length, 11)} · Suplentes {bench.length} · Bajas {unavailable.length}
              </p>
            </div>
            <CalendarDays className="h-5 w-5 text-sky-200" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {myPlayers.slice(0, 4).map((player) => (
              <PlayerCard key={player!.id} player={player!} compact onDetail={() => setSelectedPlayer(player!)} />
            ))}
          </div>
          {myPlayers.length === 0 ? <p className="text-sm text-slate-400">Compra jugadores en el mercado para armar tu plantilla.</p> : null}
        </Card>
        <ActivityFeed items={activities} />
      </section>
      <PlayerDetailDrawer player={selectedPlayer} onClose={() => setSelectedPlayer(undefined)} />
    </div>
  );
};
