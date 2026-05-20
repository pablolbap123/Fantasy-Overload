import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { supabase } from "../lib/supabaseClient";

export const AuthCallbackPage = () => {
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const finishAuth = async () => {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const authError = search.get("error_description") ?? hash.get("error_description") ?? search.get("error") ?? hash.get("error");

      if (authError) {
        setError(decodeURIComponent(authError.replace(/\+/g, " ")));
        return;
      }

      if (!supabase) {
        setError("Supabase no está configurado.");
        return;
      }

      const code = search.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setError(exchangeError.message);
            return;
          }
        }
      }

      window.history.replaceState({}, document.title, "/auth/callback");
      navigate("/leagues", { replace: true });
    };

    void finishAuth();
  }, [navigate]);

  if (!error) return <LoadingScreen />;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-lg">
        <h1 className="text-xl font-black text-white">No se pudo confirmar el email</h1>
        <p className="mt-2 text-sm text-slate-300">{error}</p>
        <Button className="mt-4" onClick={() => navigate("/auth", { replace: true })}>
          Volver al inicio de sesión
        </Button>
      </Card>
    </main>
  );
};
