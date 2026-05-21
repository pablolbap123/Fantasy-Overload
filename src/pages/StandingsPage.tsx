import { ArrowRightLeft, Euro, TrendingUp, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useFantasy } from "../store/fantasyStore";
import { formatMoney } from "../utils/formatters";

const avatarLabel = (name: string) => name.slice(0, 2).toUpperCase();

export const StandingsPage = () => {
  const { standings, members, currentLeague } = useFantasy();
  const [leftUserId, setLeftUserId] = useState(standings[0]?.userId ?? "");
  const [rightUserId, setRightUserId] = useState(standings[1]?.userId ?? standings[0]?.userId ?? "");
  useEffect(() => {
    if (!leftUserId && standings[0]) setLeftUserId(standings[0].userId);
    if (!rightUserId && standings[1]) setRightUserId(standings[1].userId);
  }, [leftUserId, rightUserId, standings]);
  const left = members.find((member) => member.userId === leftUserId);
  const right = members.find((member) => member.userId === rightUserId);
  const currentMatchdayNumber = currentLeague?.currentMatchday ?? 1;
  const visibleMatchdays = useMemo(() => {
    const numbers = new Set<number>();
    members.forEach((member) => Object.keys(member.pointsByMatchday).forEach((number) => numbers.add(Number(number))));
    Array.from({ length: currentMatchdayNumber }, (_, index) => index + 1).forEach((number) => numbers.add(number));
    return [...numbers].filter(Boolean).sort((a, b) => a - b);
  }, [currentMatchdayNumber, members]);

  const chart = useMemo(() => {
    const chartMembers = [left, right].filter(Boolean);
    const maxTotal = Math.max(
      1,
      ...chartMembers.flatMap((member) => {
        let total = 0;
        return visibleMatchdays.map((number) => {
          total += Number(member!.pointsByMatchday[number] ?? 0);
          return total;
        });
      }),
    );
    return { maxTotal, width: 640, height: 180, padding: 24 };
  }, [left, right, visibleMatchdays]);

  const lineFor = (member?: typeof left) => {
    if (!member || visibleMatchdays.length === 0) return "";
    let total = 0;
    return visibleMatchdays
      .map((number, index) => {
        total += Number(member.pointsByMatchday[number] ?? 0);
        const x = chart.padding + (index / Math.max(1, visibleMatchdays.length - 1)) * (chart.width - chart.padding * 2);
        const y = chart.height - chart.padding - (total / chart.maxTotal) * (chart.height - chart.padding * 2);
        return `${x},${y}`;
      })
      .join(" ");
  };

  if (standings.length === 0) {
    return <EmptyState title="Todavia no hay clasificacion" description="Cuando haya miembros y puntos, aparecera el ranking de la liga." />;
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#46536f] shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between border-b border-black/15 bg-[#3f4b66] px-5 py-5">
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">
              <span className="text-[#f5bd43]">Top {Math.min(100, standings.length)}</span> Managers
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-200">Clasificacion general de la liga privada</p>
          </div>
          <Trophy className="hidden h-12 w-12 text-[#f5bd43] sm:block" />
        </div>

        <div className="divide-y divide-[#25304a]">
          {standings.map((standing) => {
            const member = members.find((item) => item.userId === standing.userId);
            const tone =
              standing.position === 1
                ? "from-[#f5bd43]/20"
                : standing.position === 2
                  ? "from-[#62d7ff]/14"
                  : standing.position === 3
                    ? "from-[#ff3f55]/12"
                    : "from-white/[0.025]";
            return (
              <motion.div
                layout
                key={standing.userId}
                className={`grid grid-cols-[2.5rem_4rem_1fr_auto] items-center gap-3 bg-gradient-to-r ${tone} to-transparent px-4 py-4 sm:grid-cols-[4rem_6rem_1fr_auto] sm:px-6 sm:py-5`}
              >
                <div className="text-2xl font-black text-white sm:text-3xl">{standing.position}</div>
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#202a43] text-xl font-black text-white shadow-lg shadow-black/20 sm:h-20 sm:w-20">
                  {standing.avatarUrl ? <img src={standing.avatarUrl} alt={standing.username} className="h-full w-full object-cover" /> : avatarLabel(standing.username)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-2xl font-black text-white sm:text-4xl">{standing.username}</div>
                  <div className="mt-2 flex items-center gap-2 text-base font-black text-white sm:text-2xl">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-sm text-[#46536f]">
                      <Euro className="h-4 w-4" />
                    </span>
                    <span className="truncate">{formatMoney(standing.squadValue).replace(/\s?€/u, "")}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {visibleMatchdays.map((number) => (
                      <span
                        key={number}
                        className="rounded-md border border-white/10 bg-white/10 px-2 py-1 text-[11px] font-black text-slate-100"
                      >
                        J{number}: {member?.pointsByMatchday[number] ?? 0}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-light tracking-wide text-white sm:text-6xl">{standing.totalPoints}</div>
                  <div className="text-sm font-bold uppercase text-slate-300 sm:text-base">PFSY</div>
                  <div className="mt-1 text-sm font-black text-[#21d17f]">J{currentMatchdayNumber}: +{standing.lastMatchdayPoints}</div>
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
                    <div className="text-xs text-slate-300">PFSY</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.06] p-2">
                    <div className="font-black text-[#21d17f]">{member.lastMatchdayPoints}</div>
                    <div className="text-xs text-slate-300">Ultima</div>
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
          <div className="mb-2 text-sm font-black text-white">Evolucion completa por jornada</div>
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
          <p className="text-sm text-slate-300">La columna verde muestra los puntos de la ultima jornada calculada.</p>
        </div>
        <TrendingUp className="h-6 w-6 text-[#21d17f]" />
      </Card>
    </div>
  );
};
