import { FormEvent, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useFantasy } from "../store/fantasyStore";

export const JoinLeaguePage = () => {
  const { joinLeague } = useFantasy();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await joinLeague(code);
      navigate("/leagues");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo unir a la liga.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg p-5 sm:p-6">
        <Button variant="ghost" className="mb-4 px-2" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/leagues")}>
          Volver
        </Button>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300 text-slate-950">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Unirme con código</h1>
            <p className="text-sm text-slate-400">Introduce el codigo de invitacion que te han compartido.</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <input
            className="field text-center text-2xl font-black uppercase tracking-[0.3em]"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="OVER26"
            required
          />
          {error ? <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
          <Button className="w-full" loading={loading}>
            Unirme a la liga
          </Button>
        </form>
      </Card>
    </main>
  );
};
