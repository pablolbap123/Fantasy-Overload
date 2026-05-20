import { Download, RotateCcw, Save, Upload } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { scoringRuleLabels } from "../data/scoringRules";
import { useFantasy } from "../store/fantasyStore";
import type { ScoringRules } from "../types";

export const SettingsPage = () => {
  const {
    currentLeague,
    scoringRules,
    updateLeagueSettings,
    exportLeagueData,
    importDemoData,
    resetDemoSeason,
    demoMode,
    members,
    userId,
  } = useFantasy();
  const [name, setName] = useState(currentLeague?.name ?? "");
  const [initialBudget, setInitialBudget] = useState(currentLeague?.initialBudget ?? 150_000_000);
  const [maxMembers, setMaxMembers] = useState(currentLeague?.maxMembers ?? 12);
  const [rulesText, setRulesText] = useState(JSON.stringify(scoringRules, null, 2));
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const me = members.find((member) => member.userId === userId);
  const canAdmin = me?.role === "admin";

  const parsedRules = useMemo(() => {
    try {
      return JSON.parse(rulesText) as ScoringRules;
    } catch {
      return null;
    }
  }, [rulesText]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!parsedRules) {
      setMessage("El JSON de reglas no es válido.");
      return;
    }
    setLoading(true);
    try {
      await updateLeagueSettings({ name, initialBudget, maxMembers, scoringRules: parsedRules });
      setMessage("Ajustes guardados.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudieron guardar los ajustes.");
    } finally {
      setLoading(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([exportLeagueData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "overload-fantasy-export.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJson = () => {
    try {
      importDemoData(importText);
      setMessage("Importación completada en modo demo.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo importar.");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Ajustes y reglas</h1>
        <p className="mt-1 text-sm text-slate-400">Configura la liga, revisa reglas de puntuación y exporta datos.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <form className="space-y-4" onSubmit={save}>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-300">Nombre de liga</span>
              <input className="field" value={name} onChange={(event) => setName(event.target.value)} disabled={!canAdmin} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-300">Presupuesto inicial</span>
              <input className="field" type="number" value={initialBudget} onChange={(event) => setInitialBudget(Number(event.target.value))} disabled={!canAdmin} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-300">Máximo de miembros</span>
              <input className="field" type="number" value={maxMembers} onChange={(event) => setMaxMembers(Number(event.target.value))} disabled={!canAdmin} />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button loading={loading} disabled={!canAdmin} icon={<Save className="h-4 w-4" />}>
                Guardar ajustes
              </Button>
              <Button type="button" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportJson}>
                Exportar JSON
              </Button>
            </div>
            {message ? <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-3 text-sm text-sky-100">{message}</div> : null}
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-black text-white">Reglas de puntuación</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {scoringRuleLabels.map((rule) => (
              <div key={rule.key} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3">
                <span className="text-sm text-slate-200">{rule.label}</span>
                <span className="font-black text-emerald-200">{rule.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-black text-white">Editar reglas avanzadas</h2>
          <textarea className="field min-h-80 font-mono text-xs" value={rulesText} onChange={(event) => setRulesText(event.target.value)} disabled={!canAdmin} />
          {!parsedRules ? <p className="mt-2 text-sm text-rose-200">JSON inválido.</p> : null}
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-black text-white">Importar / reiniciar</h2>
          <textarea className="field min-h-48 font-mono text-xs" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Pega una exportación JSON" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={importJson}>
              Importar demo
            </Button>
            <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={() => window.confirm("¿Reiniciar partida demo?") && resetDemoSeason()}>
              Reiniciar partida
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {demoMode
              ? "Estás en modo demo; la importación reemplaza el estado en memoria."
              : "En online, la persistencia principal está en Supabase. Exportar no altera datos."}
          </p>
        </Card>
      </div>
    </div>
  );
};
