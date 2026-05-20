import { Crown } from "lucide-react";
import { InviteLeagueCard } from "../components/fantasy/InviteLeagueCard";
import { Card } from "../components/ui/Card";
import { useFantasy } from "../store/fantasyStore";
import { formatMoney } from "../utils/formatters";

export const MembersPage = () => {
  const { currentLeague, members } = useFantasy();
  const ownerId = currentLeague?.ownerId;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Miembros</h1>
        <p className="mt-1 text-sm text-slate-400">Presupuestos y puntos reales de la liga.</p>
      </div>
      <InviteLeagueCard league={currentLeague} />
      <div className="grid gap-3 lg:grid-cols-2">
        {members.map((member) => (
          <Card key={member.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/10 font-black text-white">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.username} className="h-full w-full object-cover" />
                  ) : (
                    member.username.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-black text-white">{member.username}</h2>
                    {member.userId === ownerId ? <Crown className="h-4 w-4 text-turbo-gold" /> : null}
                  </div>
                  <p className="text-xs text-slate-400">{member.userId === ownerId ? "Creador de la liga" : "Miembro"}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/[0.04] p-2">
                <div className="font-black text-white">{member.totalPoints}</div>
                <div className="text-xs text-slate-500">Puntos</div>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-2">
                <div className="font-black text-white">{member.lastMatchdayPoints}</div>
                <div className="text-xs text-slate-500">Última</div>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-2">
                <div className="font-black text-white">{formatMoney(member.budget).replace("€", "")}</div>
                <div className="text-xs text-slate-500">Caja</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
