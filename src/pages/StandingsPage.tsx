import { ArrowLeft, ArrowRightLeft, CalendarDays, Euro, TrendingUp, Trophy, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { FormationBoard } from "../components/fantasy/FormationBoard";
import { useFantasy } from "../store/fantasyStore";
import type { LeagueMember, Matchday } from "../types";
import { formatMoney } from "../utils/formatters";
import { playerMatchdayPoints } from "../utils/playerAvailability";

const avatarLabel = (name: string) => name.slice(0, 2).toUpperCase();
const scoreFrom = (member: LeagueMember, matchdayNumber: number) => Number(member.pointsByMatchday[matchdayNumber] ?? 0);

const joinedFromMatchday = (member: LeagueMember, matchdays: Matchday[], fallback: number) => {
  if (member.joinedMatchday > 0) return member.joinedMatchday;
  const joinedAt = new Date(member.createdAt).getTime();
  const sorted = [...matchdays].sort((a, b) => a.number - b.number);
  const firstAfterJoin = sorted.find((matchday) => new Date(matchday.startsAt).getTime() >= joinedAt);
  return firstAfterJoin?.number ?? Math.max(1, fallback);
};

type RankingMode = "total" | "matchday";

export const StandingsPage = () => {
  const { members, currentLeague, matchdays, lineups, players } = useFantasy();
  const [mode, setMode] = useState<RankingMode>("total");
  const [selectedMatchday, setSelectedMatchday] = useState(currentLeague?.currentMatchday ?? 1);
  const [leftUserId, setLeftUserId] = useState(members[0]?.userId ?? "");
  const [rightUserId, setRightUserId] = useState(members[1]?.userId ?? members[0]?.userId ?? "");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const currentMatchdayNumber = currentLeague?.currentMatchday ?? matchdays.at(-1)?.number ?? 1;
  const visibleMatchdays = useMemo(() => {
    const numbers = new Set<number>();
    members.forEach((member) => Object.keys(member.pointsByMatchday).forEach((number) => numbers.add(Number(number))));
    matchdays.forEach((matchday) => {
      if (matchday.number <= currentMatchdayNumber) numbers.add(matchday.number);
    });
    Array.from({ length: currentMatchdayNumber }, (_, index) => index + 1).forEach((number) => numbers.add(number));
    return [...numbers].filter(Boolean).sort((a, b) => a - b);
  }, [currentMatchdayNumber, matchdays, members]);

  useEffect(() => {
    if (!leftUserId && members[0]) setLeftUserId(members[0].userId);
    if (!rightUserId && members[1]) setRightUserId(members[1].userId);
    if (!visibleMatchdays.includes(selectedMatchday)) setSelectedMatchday(visibleMatchdays.at(-1) ?? currentMatchdayNumber);
  }, [currentMatchdayNumber, leftUserId, members, rightUserId, selectedMatchday, visibleMatchdays]);

  const rows = useMemo(() => {
    return members
      .map((member) => {
        const joinedFrom = joinedFromMatchday(member, matchdays, currentMatchdayNumber + 1);
        const activeMatchdays = visibleMatchdays.filter((number) => number >= joinedFrom && number <= currentMatchdayNumber);
        const activeForSelected = selectedMatchday >= joinedFrom;
        const total = Number(member.totalPoints ?? 0);
        const matchdayScore = activeForSelected ? scoreFrom(member, selectedMatchday) : null;
        const score = mode === "total" ? total : matchdayScore;
        const average = activeMatchdays.length > 0 ? total / activeMatchdays.length : 0;
        return { member, joinedFrom, activeMatchdays, score, total, matchdayScore, average };
      })
      .sort((a, b) => {
        const aScore = a.score ?? Number.NEGATIVE_INFINITY;
        const bScore = b.score ?? Number.NEGATIVE_INFINITY;
        return bScore - aScore || b.total - a.total || b.member.squadValue - a.member.squadValue;
      })
      .map((row, index) => ({ ...row, position: index + 1 }));
  }, [currentMatchdayNumber, matchdays, members, mode, selectedMatchday, visibleMatchdays]);

  const left = members.find((member) => member.userId === leftUserId);
  const right = members.find((member) => member.userId === rightUserId);

  const chart = useMemo(() => {
    const chartMembers = [left, right].filter(Boolean) as LeagueMember[];
    const totals = chartMembers.flatMap((member) => {
      const joinedFrom = joinedFromMatchday(member, matchdays, currentMatchdayNumber + 1);
      let total = 0;
      return visibleMatchdays
        .filter((number) => number >= joinedFrom)
        .map((number) => {
          total += scoreFrom(member, number);
          return total;
        });
    });
    return { maxTotal: Math.max(1, ...totals), width: 640, height: 180, padding: 24 };
  }, [currentMatchdayNumber, left, matchdays, right, visibleMatchdays]);

  const lineFor = (member?: LeagueMember) => {
    if (!member || visibleMatchdays.length === 0) return "";
    const joinedFrom = joinedFromMatchday(member, matchdays, currentMatchdayNumber + 1);
    const activeNumbers = visibleMatchdays.filter((number) => number >= joinedFrom);
    if (activeNumbers.length === 0) return "";
    let total = 0;
    return activeNumbers
      .map((number, index) => {
        total += scoreFrom(member, number);
        const x = chart.padding + (index / Math.max(1, activeNumbers.length - 1)) * (chart.width - chart.padding * 2);
        const y = chart.height - chart.padding - (total / chart.maxTotal) * (chart.height - chart.padding * 2);
        return `${x},${y}`;
      })
      .join(" ");
  };

  // Profile / rival lineup view
  const profileMember = profileUserId ? members.find((m) => m.userId === profileUserId) : null;
  const profileLineupNumbers = useMemo(() => {
    if (!profileUserId) return [];
    return lineups
      .filter((l) => l.userId === profileUserId)
      .map((l) => matchdays.find((m) => m.id === l.matchdayId)?.number)
      .filter(Boolean) as number[];
  }, [lineups, matchdays, profileUserId]);
  const [profileMatchdayNumber, setProfileMatchdayNumber] = useState<number>(currentMatchdayNumber);

  useEffect(() => {
    if (profileLineupNumbers.length > 0 && !profileLineupNumbers.includes(profileMatchdayNumber)) {
      setProfileMatchdayNumber(profileLineupNumbers.at(-1) ?? currentMatchdayNumber);
    }
  }, [profileLineupNumbers, profileMatchdayNumber, currentMatchdayNumber]);

  const profileMatchday = matchdays.find((m) => m.number === profileMatchdayNumber);
  const profileLineup = profileMatchday ? lineups.find((l) => l.userId === profileUserId && l.matchdayId === profileMatchday.id) : undefined;
  const profileStarterIds = profileLineup?.players.filter((p) => p.isStarter).map((p) => p.playerId) ?? [];
  const profilePlayers = useMemo(() => {
    if (!profileLineup) return [];
    return profileLineup.players.map((lp) => {
      return players.find((p) => p.id === lp.playerId) ?? ({
        id: lp.playerId,
        name: "Jugador",
        position: lp.position,
        teamName: "-",
        currentPrice: 0,
        totalPoints: 0,
        status: "active",
        pointsByMatchday: {},
      } as any);
    });
  }, [profileLineup, players]);

  if (members.length === 0) {
    return <EmptyState title="Todavia no hay clasificacion" description="Cuando haya miembros y puntos, aparecera el ranking de la liga." />;
  }

  // Profile detail view
  if (profileMember) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
            onClick={() => setProfileUserId(null)}
          >
            <ArrowLeft className="h-4 w-4" /> Clasificación
          </button>
          <h1 className="text-2xl font-black text-white">{profileMember.username}</h1>
        </div>

        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#202a43] text-xl font-black text-white">
              {profileMember.avatarUrl ? <img src={profileMember.avatarUrl} alt={profileMember.username} className="h-full w-full object-cover" /> : avatarLabel(profileMember.username)}
            </div>
            <div>
              <div className="text-xl font-black text-white">{profileMember.username}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-sm font-bold text-slate-300">
                <span>{profileMember.totalPoints} PFSY</span>
                <span>·</span>
                <span>{formatMoney(profileMember.squadValue)} valor</span>
                <span>·</span>
                <span>{formatMoney(profileMember.budget)} caja</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-black text-white">Once · J{profileMatchdayNumber}</h2>
            <div className="text-sm font-bold text-[#21d17f]">
              {scoreFrom(profileMember, profileMatchdayNumber)} pts
            </div>
          </div>

          {profileLineupNumbers.length > 0 ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {profileLineupNumbers.sort((a, b) => a - b).map((number) => (
                <button
                  key={number}
                  className={`min-w-14 rounded-lg border px-3 py-2 text-center text-sm font-black transition ${
                    profileMatchdayNumber === number
                      ? "border-[#62d7ff]/60 bg-[#62d7ff]/15 text-white"
                      : "border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10"
                  }`}
                  onClick={() => setProfileMatchdayNumber(number)}
                >
                  J{number}
                </button>
              ))}
            </div>
          ) : null}

          {profileLineup && profileStarterIds.length > 0 ? (
            <FormationBoard
              formation={profileLineup.formation}
              players={profilePlayers}
              starterIds={profileStarterIds}
              matchdayNumber={profileMatchdayNumber}
              readOnly
              captainPlayerId={profileLineup.captainPlayerId}
            />
          ) : (
            <EmptyState title="Sin alineación guardada" description="Este manager no ha subido once para esta jornada." />
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#46536f] shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-4 border-b border-black/15 bg-[#3f4b66] px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">
              <span className="text-[#f5bd43]">Top {Math.min(100, rows.length)}</span> Managers
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {mode === "total" ? "Clasificacion total desde que cada manager entro en la liga" : `Ranking solo de la jornada ${selectedMatchday}`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex rounded-lg border border-white/10 bg-white/10 p-1">
              <button
                className={`rounded-md px-3 py-2 text-sm font-black ${mode === "total" ? "bg-[#f5bd43] text-[#11182d]" : "text-white"}`}
                onClick={() => setMode("total")}
              >
                Total
              </button>
              <button
                className={`rounded-md px-3 py-2 text-sm font-black ${mode === "matchday" ? "bg-[#62d7ff] text-[#11182d]" : "text-white"}`}
                onClick={() => setMode("matchday")}
              >
                Jornada
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <CalendarDays className="h-4 w-4 text-[#62d7ff]" />
              <select className="field min-h-9 py-1.5" value={selectedMatchday} onChange={(event) => setSelectedMatchday(Number(event.target.value))}>
                {visibleMatchdays.map((number) => (
                  <option key={number} value={number}>
                    Jornada {number}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="divide-y divide-[#25304a]">
          {rows.map((row) => {
            const { member } = row;
            const scoreLabel = mode === "total" ? "PFSY" : `J${selectedMatchday}`;
            const scoreText = row.score === null ? "-" : row.score;
            const tone =
              row.position === 1
                ? "from-[#f5bd43]/20"
                : row.position === 2
                  ? "from-[#62d7ff]/14"
                  : row.position === 3
                    ? "from-[#ff3f55]/12"
                    : "from-white/[0.025]";
            return (
              <motion.div
                layout
                key={member.userId}
                className={`grid grid-cols-[2rem_3.25rem_1fr] gap-3 bg-gradient-to-r ${tone} to-transparent px-3 py-4 sm:grid-cols-[3.5rem_5rem_1fr_auto] sm:items-center sm:px-6 sm:py-5`}
              >
                <div className="pt-2 text-xl font-black text-white sm:pt-0 sm:text-3xl">{row.position}</div>
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#202a43] text-base font-black text-white shadow-lg shadow-black/20 sm:h-20 sm:w-20 sm:border-4 sm:text-xl">
                  {member.avatarUrl ? <img src={member.avatarUrl} alt={member.username} className="h-full w-full object-cover" /> : avatarLabel(member.username)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-xl font-black text-white sm:text-4xl">{member.username}</div>
                    <button
                      className="shrink-0 rounded-lg border border-white/10 bg-white/[0.07] p-1.5 text-slate-300 hover:bg-white/15 hover:text-white"
                      onClick={() => setProfileUserId(member.userId)}
                      title="Ver equipo"
                    >
                      <Users className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-100 sm:text-sm">
                    <span className="rounded-md bg-white/10 px-2 py-1">Desde J{row.joinedFrom}</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">Media {row.average.toFixed(1)}</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">Caja {formatMoney(member.budget)}</span>
                  </div>
                  <div className="mt-2 flex min-w-0 items-center gap-2 text-sm font-black text-white sm:text-lg">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm text-[#46536f]">
                      <Euro className="h-4 w-4" />
                    </span>
                    <span className="truncate">{formatMoney(member.squadValue).replace(/\s?€/u, "")}</span>
                  </div>
                  <div className="mt-3 flex max-w-full gap-1.5 overflow-x-auto pb-1">
                    {visibleMatchdays.map((number) => {
                      const active = number >= row.joinedFrom;
                      return (
                        <span
                          key={number}
                          className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-black ${
                            active ? "border-white/10 bg-white/10 text-slate-100" : "border-slate-500/10 bg-slate-900/25 text-slate-500"
                          }`}
                        >
                          J{number}: {active ? scoreFrom(member, number) : "-"}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="col-span-3 rounded-lg bg-slate-950/20 px-3 py-2 text-right sm:col-span-1 sm:bg-transparent sm:px-0 sm:py-0">
                  <div className="text-4xl font-light tracking-wide text-white sm:text-6xl">{scoreText}</div>
                  <div className="text-sm font-bold uppercase text-slate-300 sm:text-base">{scoreLabel}</div>
                  <div className="mt-1 text-sm font-black text-[#21d17f]">Total: {member.totalPoints}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-[#62d7ff]" />
          <h2 className="text-base font-black text-white">Comparador entre managers</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <select className="field" value={leftUserId} onChange={(event) => setLeftUserId(event.target.value)}>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.username}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            className="hidden sm:inline-flex"
            onClick={() => {
              setLeftUserId(rightUserId);
              setRightUserId(leftUserId);
            }}
          >
            vs
          </Button>
          <select className="field" value={rightUserId} onChange={(event) => setRightUserId(event.target.value)}>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.username}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[left, right].map((member) =>
            member ? (
              <div key={member.userId} className="rounded-lg border border-white/10 bg-[#202a43]/80 p-4">
                <div className="text-lg font-black text-white">{member.username}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white/[0.06] p-2">
                    <div className="font-black text-white">{member.totalPoints}</div>
                    <div className="text-xs text-slate-300">Total</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.06] p-2">
                    <div className="font-black text-[#21d17f]">{scoreFrom(member, selectedMatchday)}</div>
                    <div className="text-xs text-slate-300">J{selectedMatchday}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.06] p-2">
                    <div className="truncate font-black text-white">{formatMoney(member.budget).replace(/\s?€/u, "")}</div>
                    <div className="text-xs text-slate-300">Caja</div>
                  </div>
                </div>
              </div>
            ) : null,
          )}
        </div>
        <div className="mt-4 rounded-lg border border-white/10 bg-[#202a43]/80 p-3">
          <div className="mb-2 text-sm font-black text-white">Evolucion desde entrada en liga</div>
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-48 w-full overflow-visible">
            {[0, 0.5, 1].map((ratio) => (
              <line
                key={ratio}
                x1={chart.padding}
                x2={chart.width - chart.padding}
                y1={chart.padding + ratio * (chart.height - chart.padding * 2)}
                y2={chart.padding + ratio * (chart.height - chart.padding * 2)}
                stroke="rgba(255,255,255,.10)"
              />
            ))}
            <polyline points={lineFor(left)} fill="none" stroke="#62d7ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={lineFor(right)} fill="none" stroke="#f5bd43" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex flex-wrap gap-3 text-xs font-bold">
            <span className="text-[#62d7ff]">{left?.username ?? "Manager 1"}</span>
            <span className="text-[#f5bd43]">{right?.username ?? "Manager 2"}</span>
          </div>
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white">Ranking por jornada</h2>
          <p className="text-sm text-slate-300">Usa el selector superior para ver quien fue el mejor de cada jornada o vuelve a Total para la general.</p>
        </div>
        {mode === "matchday" ? <TrendingUp className="h-6 w-6 text-[#21d17f]" /> : <Trophy className="h-6 w-6 text-[#f5bd43]" />}
      </Card>
    </div>
  );
};
