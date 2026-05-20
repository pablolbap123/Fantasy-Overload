import { BarChart3, CalendarDays, Home, LineChart, LogOut, RefreshCw, Settings, Shield, Store, Trophy, Users, Wifi } from "lucide-react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { clsx } from "clsx";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useFantasy } from "../../store/fantasyStore";
import { LeagueIntroOverlay } from "../fantasy/LeagueIntroOverlay";
import { Button } from "../ui/Button";
import { formatDate } from "../../utils/formatters";

const navItems = [
  { label: "Inicio", to: "home", icon: Home },
  { label: "Equipo", to: "team", icon: Shield },
  { label: "Mercado", to: "market", icon: Store },
  { label: "Jornada", to: "matchday", icon: CalendarDays },
  { label: "Ranking", to: "standings", icon: Trophy },
  { label: "Stats", to: "stats", icon: BarChart3 },
  { label: "Miembros", to: "members", icon: Users },
  { label: "Admin", to: "admin", icon: LineChart },
  { label: "Ajustes", to: "settings", icon: Settings },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition",
    isActive
      ? "bg-gradient-to-r from-[#ff3f55] to-[#f5bd43] text-white shadow-lg shadow-[#ff3f55]/20"
      : "text-slate-200 hover:bg-white/10 hover:text-white",
  );

const syncTone = (status?: string) =>
  clsx(
    "border text-xs font-black",
    status === "error" && "border-[#ff3f55]/45 bg-[#ff3f55]/15 text-[#ffc2ca]",
    status === "checking" && "border-[#62d7ff]/45 bg-[#62d7ff]/15 text-[#b9efff]",
    status === "changed" && "border-[#21d17f]/45 bg-[#21d17f]/15 text-[#a9ffd4]",
    status === "ok" && "border-[#f5bd43]/40 bg-[#f5bd43]/12 text-[#ffe0a2]",
    (!status || status === "idle") && "border-white/10 bg-white/6 text-slate-300",
  );

export const AppShell = () => {
  const { leagueId } = useParams();
  const { currentLeague, selectLeague, profile, signOut, demoMode, onlineReady, players, leaguePlayers, userId, challengeSyncStatus } = useFantasy();
  const navigate = useNavigate();

  useEffect(() => {
    if (leagueId && leagueId !== currentLeague?.id) void selectLeague(leagueId);
  }, [currentLeague?.id, leagueId, selectLeague]);

  const liveStatus = challengeSyncStatus?.status ?? (onlineReady ? "idle" : undefined);
  const liveMessage = challengeSyncStatus?.message ?? (onlineReady ? "Esperando watcher de Challenge." : "Solo disponible en modo online.");
  const liveChecked = challengeSyncStatus?.lastCheckedAt ? formatDate(challengeSyncStatus.lastCheckedAt) : "Pendiente";

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <LeagueIntroOverlay leagueId={currentLeague?.id} userId={userId} players={players} leaguePlayers={leaguePlayers} />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/10 bg-[#080d1b]/95 p-4 backdrop-blur-xl lg:block">
        <button className="mb-6 flex w-full items-center gap-3 text-left" onClick={() => navigate("/leagues")}>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black text-lg font-black text-white shadow-lg shadow-[#f5bd43]/15 ring-1 ring-[#f5bd43]/30">
            <span className="text-[#f5bd43]">O</span>
          </div>
          <div>
            <div className="text-sm font-black text-white">Overload Fantasy</div>
            <div className="text-xs text-slate-400">{currentLeague?.name ?? "Selecciona liga"}</div>
          </div>
        </button>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={`/league/${leagueId}/${item.to}`} className={navClass}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 space-y-3">
          <div className={clsx("rounded-lg p-3", syncTone(liveStatus))}>
            <div className="flex items-center gap-2">
              {liveStatus === "checking" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              <span>Challenge en vivo</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] font-semibold opacity-90">{liveMessage}</p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] opacity-70">Ultima comprobacion: {liveChecked}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#202a43]/85 p-3">
            <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{profile?.username ?? "Manager"}</div>
              <div className="text-xs text-slate-400">{onlineReady ? "Online realtime" : demoMode ? "Modo demo" : "Sin sesión"}</div>
            </div>
            <Button variant="ghost" className="min-h-9 px-2" aria-label="Cerrar sesión" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          </div>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080d1b]/82 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
            <button className="flex min-w-0 items-center gap-3 text-left lg:hidden" onClick={() => navigate("/leagues")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-sm font-black text-[#f5bd43] ring-1 ring-[#f5bd43]/35">
                O
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-white">Overload Fantasy</div>
                <div className="truncate text-xs text-slate-400">{currentLeague?.name ?? "Liga"}</div>
              </div>
            </button>
            <div className="hidden min-w-0 lg:block">
              <h1 className="truncate text-xl font-black text-white">{currentLeague?.name ?? "Overload Series Simulación"}</h1>
              <p className="text-sm text-slate-400">Código: {currentLeague?.inviteCode ?? "----"}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={clsx("flex h-10 w-10 items-center justify-center rounded-lg sm:hidden", syncTone(liveStatus))} title={liveMessage}>
                {liveStatus === "checking" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              </div>
              <div className={clsx("hidden items-center gap-2 rounded-lg px-3 py-2 sm:flex", syncTone(liveStatus))}>
                {liveStatus === "checking" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                <span>Challenge live</span>
              </div>
              <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => navigate("/leagues")}>
                Mis ligas
              </Button>
              <Button variant="ghost" className="min-h-10 px-3" onClick={() => navigate("/profile")}>
                {profile?.username?.slice(0, 2).toUpperCase() ?? "ME"}
              </Button>
            </div>
          </div>
        </header>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="mx-auto max-w-7xl px-4 py-5"
        >
          <Outlet />
        </motion.div>
      </main>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#080d1b]/92 px-2 pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {navItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={`/league/${leagueId}/${item.to}`}
              className={({ isActive }) =>
                clsx(
                  "flex flex-col items-center justify-center rounded-lg px-1 py-2 text-[11px] font-bold transition",
                  isActive ? "bg-gradient-to-r from-[#ff3f55] to-[#f5bd43] text-white" : "text-slate-400",
                )
              }
            >
              <item.icon className="mb-1 h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
