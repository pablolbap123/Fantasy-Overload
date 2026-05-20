import { FormEvent, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useFantasy } from "../store/fantasyStore";

export const ProfilePage = () => {
  const { profile, updateProfile, signOut } = useFantasy();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? "");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await updateProfile({ username, avatarUrl });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-xl p-5 sm:p-6">
        <Button variant="ghost" className="mb-4 px-2" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(-1)}>
          Volver
        </Button>
        <h1 className="text-2xl font-black text-white">Perfil de manager</h1>
        <p className="mt-1 text-sm text-slate-400">Actualiza tu nombre visible y avatar.</p>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-300">Nombre</span>
            <input className="field" value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-300">Avatar URL</span>
            <input className="field" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." />
          </label>
          <Button loading={loading} icon={<Save className="h-4 w-4" />}>
            Guardar perfil
          </Button>
        </form>
        <Button className="mt-6 w-full" variant="secondary" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </Card>
    </main>
  );
};
