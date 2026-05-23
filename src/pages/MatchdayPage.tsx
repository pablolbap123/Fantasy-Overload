import { Zap } from "lucide-react";
<<<<<<< HEAD
import { useMemo, useState } from "react";
=======
import { useEffect, useMemo, useState } from "react";
>>>>>>> 6bc6cc2 (Version 2.2)
import type { Match, PlayerMatchStats } from "../types";
import { MatchCard } from "../components/matches/MatchCard";
import { PlayerDetailDrawer } from "../components/players/PlayerDetailDrawer";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useFantasy } from "../store/fantasyStore";

export const MatchdayPage = () => {
  const { currentLeague, matchdays, teams, players } = useFantasy();
<<<<<<< HEAD
  const [selectedMatchdayId, setSelectedMatchdayId] = useState(matchdays[0]?.id ?? "");
  const [selectedMatch, setSelectedMatch] = useState<Match | undefined>();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>();
  const selectedMatchday = matchdays.find((matchday) => matchday.id === selectedMatchdayId) ?? matchdays[0];
=======
  const latestMatchday = useMemo(() => [...matchdays].sort((a, b) => b.number - a.number)[0], [matchdays]);
  const latestResultMatchday = useMemo(
    () =>
      [...matchdays]
        .filter((matchday) =>
          matchday.matches.some(
            (match) =>
              match.status === "finalizada" ||
              match.homeScore !== null ||
              match.awayScore !== null ||
              match.playerStats.length > 0,
          ),
        )
        .sort((a, b) => b.number - a.number)[0],
    [matchdays],
  );
  const defaultMatchday = latestResultMatchday ?? latestMatchday;
  const [selectedMatchdayId, setSelectedMatchdayId] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<Match | undefined>();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>();
  const selectedMatchday = matchdays.find((matchday) => matchday.id === selectedMatchdayId) ?? defaultMatchday;

  useEffect(() => {
    if (!defaultMatchday) return;
    const selectedStillExists = matchdays.some((matchday) => matchday.id === selectedMatchdayId);
    if (!selectedMatchdayId || !selectedStillExists) {
      setSelectedMatchdayId(defaultMatchday.id);
      setSelectedMatch(undefined);
    }
  }, [defaultMatchday, matchdays, selectedMatchdayId]);
>>>>>>> 6bc6cc2 (Version 2.2)

  const topStats = useMemo(() => {
    const stats = selectedMatch?.playerStats ?? [];
    return [...stats].sort((a, b) => (b.fantasyPoints ?? 0) - (a.fantasyPoints ?? 0)).slice(0, 10);
  }, [selectedMatch]);

  if (matchdays.length === 0) {
    return <EmptyState title="TodavÃ­a no hay jornadas" description="Cuando se sincronicen datos oficiales de Challenge aparecerÃ¡n aquÃ­." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-black text-white">Jornadas y calendario</h1>
          <p className="mt-1 text-sm text-slate-400">Jornada actual {currentLeague?.currentMatchday ?? 6} Â· resultados oficiales, eventos y puntos fantasy.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {matchdays.map((matchday) => (
          <button
            key={matchday.id}
            className={`min-w-32 rounded-2xl border p-3 text-left transition ${
              selectedMatchday?.id === matchday.id
                ? "border-sky-300/50 bg-sky-300/15"
                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
            }`}
            onClick={() => {
              setSelectedMatchdayId(matchday.id);
              setSelectedMatch(undefined);
            }}
          >
            <div className="font-black text-white">Jornada {matchday.number}</div>
            <div className="mt-1 text-xs text-slate-400">{matchday.status}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <section className="space-y-3">
          {selectedMatchday.matches.map((match) => (
            <MatchCard key={match.id} match={match} teams={teams} onClick={() => setSelectedMatch(match)} />
          ))}
        </section>
        <section>
          <Card>
            {selectedMatch ? (
              <>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-xl font-black text-white">
                      {selectedMatch.homeTeamName} {selectedMatch.status === "finalizada" ? `${selectedMatch.homeScore}-${selectedMatch.awayScore}` : "vs"}{" "}
                      {selectedMatch.awayTeamName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">Detalle del partido y puntos generados.</p>
                  </div>
                  <Badge className="bg-white/10 text-slate-100 ring-white/10">{selectedMatch.status}</Badge>
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-300">Eventos</h3>
                    <div className="space-y-2">
                      {selectedMatch.events.map((event) => (
                        <div key={event.id} className="rounded-xl bg-white/[0.04] p-3 text-sm text-slate-100">
                          <span className="font-black text-sky-200">{event.minute}'</span> {event.description}
                        </div>
                      ))}
                      {selectedMatch.events.length === 0 ? <p className="text-sm text-slate-400">Sin eventos todavÃ­a.</p> : null}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-300">Puntos fantasy</h3>
                    <div className="space-y-2">
                      {topStats.map((stat: PlayerMatchStats) => {
                        const player = players.find((item) => item.id === stat.playerId);
                        return (
                          <button
                            key={`${stat.matchId}-${stat.playerId}`}
                            className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
                            onClick={() => setSelectedPlayerId(player?.id)}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-white">{player?.name ?? "Jugador"}</div>
                              <div className="text-xs text-slate-500">
                                {stat.goals}G / {stat.assists}A / {stat.yellowCards + stat.redCards}T
                              </div>
                            </div>
                            <div className="text-lg font-black text-emerald-200">{stat.fantasyPoints ?? 0}</div>
                          </button>
                        );
                      })}
                      {topStats.length === 0 ? <p className="text-sm text-slate-400">Los puntos aparecerÃ¡n cuando el partido tenga estadÃ­sticas oficiales cargadas.</p> : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <Zap className="h-10 w-10 text-sky-200" />
                <h2 className="mt-3 text-lg font-black text-white">Selecciona un partido</h2>
                <p className="mt-1 max-w-md text-sm text-slate-400">VerÃ¡s goleadores, asistentes, tarjetas, MVP y puntos fantasy generados por cada jugador.</p>
              </div>
            )}
          </Card>
        </section>
      </div>
      <PlayerDetailDrawer player={players.find((player) => player.id === selectedPlayerId)} onClose={() => setSelectedPlayerId(undefined)} />
    </div>
  );
};
<<<<<<< HEAD

=======
>>>>>>> 6bc6cc2 (Version 2.2)
