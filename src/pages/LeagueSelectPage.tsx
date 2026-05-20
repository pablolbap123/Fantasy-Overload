import { Eye, Plus, Share2, Trash2, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useFantasy } from "../store/fantasyStore";
import { formatMoney } from "../utils/formatters";

export const LeagueSelectPage = () => {
  const { leagues, selectLeague, members, demoMode, onlineReady, enterDemoMode, deleteLeague, userId } = useFantasy();
  const navigate = useNavigate();

  const openLeague = async (leagueId: string) => {
    await selectLeague(leagueId);
    navigate(`/league/${leagueId}/home`);
  };

  const openPreview = () => {
    enterDemoMode();
    window.setTimeout(() => navigate("/league/league-demo/home"), 0);
  };

  const removeLeague = async (leagueId: string, leagueName: string) => {
    const confirmed = window.confirm(`Eliminar "${leagueName}"? Esta accion no se puede deshacer.`);
    if (!confirmed) return;
    await deleteLeague(leagueId);
  };

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-black text-white">Mis ligas fantasy</h1>
            <p className="mt-1 text-sm text-slate-400">
              {onlineReady ? "Conectado a Supabase Realtime." : demoMode ? "Modo demo para revisar la experiencia." : "Inicia sesión para jugar online."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={openPreview}>
              Ver menú
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/leagues/create")}>
              Crear
            </Button>
            <Button variant="secondary" icon={<Share2 className="h-4 w-4" />} onClick={() => navigate("/leagues/join")}>
              Unirme
            </Button>
          </div>
        </div>

        {leagues.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Todavía no tienes ligas"
              description="Puedes abrir una vista previa completa del fantasy o crear una liga privada cuando Supabase esté listo."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button icon={<Eye className="h-4 w-4" />} onClick={openPreview}>
                    Ver menú demo
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/leagues/create")}>
                    Crear liga real
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {leagues.map((league, index) => {
              const leagueMembers = members.filter((member) => member.leagueId === league.id);
              const memberCount = league.memberCount ?? leagueMembers.length;
              return (
                <motion.div
                  key={league.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="text-left"
                >
                  <Card className="h-full border-emerald-300/20 transition hover:-translate-y-0.5 hover:border-emerald-300/35">
                    <button className="block w-full text-left" onClick={() => void openLeague(league.id)}>
                      <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-300/10 bg-emerald-300/10 p-3">
                      <div>
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-300 via-sky-300 to-turbo-gold text-lg font-black text-slate-950">
                          <Trophy className="h-6 w-6" />
                        </div>
                        <h2 className="text-lg font-black text-white">{league.name}</h2>
                        <p className="mt-1 text-sm font-semibold text-emerald-100">Codigo {league.inviteCode}</p>
                      </div>
                      <span className="rounded-full border border-turbo-gold/30 bg-turbo-gold/10 px-3 py-1 text-xs font-black text-turbo-gold">
                        J{league.currentMatchday}
                      </span>
                      </div>
                    </button>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border border-emerald-300/10 bg-slate-950/45 p-2">
                        <div className="font-black text-white">{memberCount}</div>
                        <div className="text-xs text-slate-500">Miembros</div>
                      </div>
                      <div className="rounded-lg border border-emerald-300/10 bg-slate-950/45 p-2">
                        <div className="font-black text-white">{league.maxMembers}</div>
                        <div className="text-xs text-slate-500">Máx.</div>
                      </div>
                      <div className="rounded-lg border border-emerald-300/10 bg-slate-950/45 p-2">
                        <div className="font-black text-white">{formatMoney(league.initialBudget).replace("€", "")}</div>
                        <div className="text-xs text-slate-500">Inicio</div>
                      </div>
                    </div>
                    {league.ownerId === userId ? (
                      <Button
                        className="mt-3 w-full"
                        variant="danger"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => void removeLeague(league.id, league.name)}
                      >
                        Eliminar liga
                      </Button>
                    ) : null}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};
