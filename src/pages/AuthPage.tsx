import { FormEvent, useState } from "react";
import { Mail, Sparkles } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ChallengeSyncButton } from "../components/fantasy/ChallengeSyncButton";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { useFantasy } from "../store/fantasyStore";

type Mode = "login" | "register" | "reset";

export const AuthPage = () => {
  const { userId, signIn, signUp, resetPassword } = useFantasy();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (userId) return <Navigate to="/leagues" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        navigate("/leagues");
      } else if (mode === "register") {
        await signUp(email, password, username || email.split("@")[0]);
        setMessage("Cuenta creada. Revisa tu correo si tu proyecto Supabase requiere confirmación.");
      } else {
        await resetPassword(email);
        setMessage("Te hemos enviado un correo para recuperar tu contraseña.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la operación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col justify-center">
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full fantasy-strip px-3 py-1 text-sm font-bold">
            <Sparkles className="h-4 w-4" />
            Fantasy online para Overload Series Simulación
          </div>
          <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">Mercado, once y ranking con tus amigos.</h1>
          <p className="mt-4 max-w-xl text-base text-slate-300">
            Registro real, ligas privadas con código, mercado compartido, alineaciones bloqueables, jornadas oficiales y ranking en tiempo real con Supabase.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {["Auth", "Ligas", "Realtime"].map((item) => (
              <div key={item} className="rounded-lg border border-emerald-300/10 bg-slate-900/80 p-4 shadow-2xl shadow-black/20">
                <div className="text-lg font-black text-white">{item}</div>
                <div className="text-xs font-bold text-emerald-200">online</div>
              </div>
            ))}
          </div>
          {isSupabaseConfigured ? (
            <div className="mt-5 rounded-lg border border-[#62d7ff]/20 bg-[#62d7ff]/10 p-4">
              <div className="mb-3 text-sm font-black text-white">Challenge en vivo</div>
              <ChallengeSyncButton />
            </div>
          ) : null}
        </motion.section>

        <Card className="p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-2xl font-black text-white">
              {mode === "login" ? "Iniciar sesión" : mode === "register" ? "Crear cuenta" : "Recuperar contraseña"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">Accede para competir con tus amigos en ligas privadas.</p>
          </div>
          <form className="space-y-3" onSubmit={submit}>
            {mode === "register" ? (
              <input className="field" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Nombre de manager" />
            ) : null}
            <input className="field" value={email} type="email" onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
            {mode !== "reset" ? (
              <input
                className="field"
                value={password}
                type="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contraseña"
                required
                minLength={6}
              />
            ) : null}
            {error ? <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
            {message ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</div> : null}
            <Button className="w-full" loading={loading} icon={<Mail className="h-4 w-4" />}>
              {mode === "login" ? "Entrar" : mode === "register" ? "Registrarme" : "Enviar recuperación"}
            </Button>
          </form>
          <div className="mt-4 grid gap-2 text-sm">
            <button className="text-left text-sky-200 hover:text-sky-100" onClick={() => setMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Crear una cuenta nueva" : "Ya tengo cuenta"}
            </button>
            <button className="text-left text-slate-400 hover:text-slate-200" onClick={() => setMode("reset")}>
              Recuperar contraseña
            </button>
          </div>
          {!isSupabaseConfigured ? (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
              <p className="text-sm text-amber-50">Supabase no esta configurado. Para jugar online necesitas configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.</p>
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
};
