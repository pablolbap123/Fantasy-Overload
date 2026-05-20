import { FormEvent, useState } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { defaultScoringRules } from "../data/scoringRules";
import { useFantasy } from "../store/fantasyStore";
import { getErrorMessage } from "../utils/errors";

export const CreateLeaguePage = () => {
  const { createLeague } = useFantasy();
  const [name, setName] = useState("Overload Friends League");
  const [initialBudget, setInitialBudget] = useState(150_000_000);
  const [maxMembers, setMaxMembers] = useState(12);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const leagueId = await createLeague({ name, initialBudget, maxMembers, scoringRules: defaultScoringRules });
      navigate(leagueId ? `/league/${leagueId}/home` : "/leagues");
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo crear la liga."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-xl p-5 sm:p-6">
        <Button variant="ghost" className="mb-4 px-2" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/leagues")}>
          Volver
        </Button>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300 text-slate-950">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Crear liga privada</h1>
            <p className="text-sm text-slate-400">Configura presupuesto y plazas para jugar online.</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-300">Nombre de liga</span>
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-300">Presupuesto inicial</span>
            <input className="field" type="number" step="1000000" value={initialBudget} onChange={(event) => setInitialBudget(Number(event.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-300">Máximo de participantes</span>
            <input className="field" type="number" min={2} max={30} value={maxMembers} onChange={(event) => setMaxMembers(Number(event.target.value))} />
          </label>
          {error ? <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
          <Button className="w-full" loading={loading}>
            Crear liga y mercado
          </Button>
        </form>
      </Card>
    </main>
  );
};
