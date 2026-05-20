import { Lock, Save, ShieldAlert, Unlock } from "lucide-react";
import { useState } from "react";
import type { Match } from "../types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useFantasy } from "../store/fantasyStore";

export const AdminPage = () => {
  const { currentLeague, members, userId, matchdays, updateMatchResult, updateLeagueSettings } = useFantasy();
  const [adminMode, setAdminMode] = useState(false);
  const [editing, setEditing] = useState<Record<string, { home: number; away: number }>>({});
  const [message, setMessage] = useState("");
  const me = members.find((member) => member.userId === userId);
  const isAdmin = me?.role === "admin";

  if (!isAdmin) {
    return <EmptyState title="Solo el admin puede gestionar resultados" description="Puedes seguir viendo jornadas, mercado y clasificación como miembro." />;
  }

  const saveMatch = async (match: Match) => {
    const score = editing[match.id];
    if (!score) return;
    await updateMatchResult({ ...match, homeScore: score.home, awayScore: score.away, status: "finalizada" });
  };

  const run = async (action: () => Promise<void>, ok: string) => {
    setMessage("");
    try {
      await action();
      setMessage(ok);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo completar la acción.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-black text-white">Administración de resultados</h1>
          <p className="mt-1 text-sm text-slate-400">Edición manual para corregir resultados oficiales cargados desde Challenge.</p>
        </div>
        <Button variant={adminMode ? "primary" : "secondary"} icon={<ShieldAlert className="h-4 w-4" />} onClick={() => setAdminMode((value) => !value)}>
          Modo admin
        </Button>
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            disabled={!adminMode}
            variant="secondary"
            icon={currentLeague?.marketLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            onClick={() => void run(() => updateLeagueSettings({ marketLocked: !currentLeague?.marketLocked }), "Mercado actualizado.")}
          >
            {currentLeague?.marketLocked ? "Abrir mercado" : "Bloquear mercado"}
          </Button>
          <Button
            disabled={!adminMode}
            variant="secondary"
            icon={currentLeague?.lineupsLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            onClick={() => void run(() => updateLeagueSettings({ lineupsLocked: !currentLeague?.lineupsLocked }), "Alineaciones actualizadas.")}
          >
            {currentLeague?.lineupsLocked ? "Abrir alineaciones" : "Bloquear alineaciones"}
          </Button>
        </div>
        {message ? <div className="mt-3 rounded-xl border border-sky-300/20 bg-sky-500/10 p-3 text-sm text-sky-100">{message}</div> : null}
      </Card>

      <div className="space-y-4">
        {matchdays.map((matchday) => (
          <Card key={matchday.id}>
            <h2 className="mb-3 text-base font-black text-white">Jornada {matchday.number}</h2>
            <div className="space-y-2">
              {matchday.matches.map((match) => {
                const values = editing[match.id] ?? { home: match.homeScore ?? 0, away: match.awayScore ?? 0 };
                return (
                  <div key={match.id} className="grid gap-2 rounded-xl bg-white/[0.04] p-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <div className="min-w-0 text-sm font-bold text-white">
                      {match.homeTeamName} vs {match.awayTeamName}
                    </div>
                    <input
                      className="field w-full md:w-20"
                      type="number"
                      min={0}
                      disabled={!adminMode}
                      value={values.home}
                      onChange={(event) => setEditing((current) => ({ ...current, [match.id]: { ...values, home: Number(event.target.value) } }))}
                    />
                    <input
                      className="field w-full md:w-20"
                      type="number"
                      min={0}
                      disabled={!adminMode}
                      value={values.away}
                      onChange={(event) => setEditing((current) => ({ ...current, [match.id]: { ...values, away: Number(event.target.value) } }))}
                    />
                    <Button disabled={!adminMode} variant="secondary" icon={<Save className="h-4 w-4" />} onClick={() => void saveMatch(match)}>
                      Guardar
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
