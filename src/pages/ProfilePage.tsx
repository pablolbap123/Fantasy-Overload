import { useMemo, useState } from "react";
import { ArrowLeft, Camera, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useFantasy } from "../store/fantasyStore";
import { getErrorMessage } from "../utils/errors";
import { formatMoney } from "../utils/formatters";

export const ProfilePage = () => {
  const { profile, userId, members, transfers, leagues, updateProfile, uploadAvatar, signOut } = useFantasy();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(profile?.avatarUrl ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const myMemberships = members.filter((member) => member.userId === userId);
    const totalPoints = myMemberships.reduce((sum, member) => sum + member.totalPoints, 0);
    const bestMatchday = myMemberships.reduce(
      (best, member) => Math.max(best, ...Object.values(member.pointsByMatchday).map((value) => Number(value))),
      0,
    );
    const squadValue = myMemberships.reduce((sum, member) => sum + member.squadValue, 0);
    return { totalPoints, bestMatchday, squadValue, leagueCount: leagues.length };
  }, [leagues.length, members, userId]);

  const save = async () => {
    setError("");
    setLoading(true);
    try {
      await updateProfile({ username, avatarUrl });
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo guardar el perfil."));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    try {
      const publicUrl = await uploadAvatar(file);
      setAvatarUrl(publicUrl);
      setPreviewUrl(publicUrl);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo subir el avatar. Revisa que exista el bucket avatars en Supabase."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <Card className="p-5 sm:p-6">
          <Button variant="ghost" className="mb-4 px-2" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(-1)}>
            Volver
          </Button>
          <h1 className="text-2xl font-black text-white">Perfil de manager</h1>
          <p className="mt-1 text-sm text-slate-400">Nombre, avatar y resumen competitivo.</p>

          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#202a43] text-2xl font-black text-white">
              {previewUrl ? <img src={previewUrl} alt={username} className="h-full w-full object-cover" /> : username.slice(0, 2).toUpperCase()}
            </div>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-black text-white hover:bg-white/15">
              <Camera className="h-4 w-4" />
              Subir imagen
              <input className="hidden" type="file" accept="image/*" onChange={(event) => void handleFile(event.target.files?.[0])} />
            </label>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-300">Nombre</span>
              <input className="field" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-300">Avatar URL</span>
              <input
                className="field"
                value={avatarUrl}
                onChange={(event) => {
                  setAvatarUrl(event.target.value);
                  setPreviewUrl(event.target.value);
                }}
                placeholder="https://..."
              />
            </label>
            {error ? <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
            <Button loading={loading} icon={<Save className="h-4 w-4" />} onClick={() => void save()}>
              Guardar perfil
            </Button>
          </div>
          <Button className="mt-6 w-full" variant="secondary" onClick={() => void signOut()}>
            Cerrar sesion
          </Button>
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-base font-black text-white">Estadisticas del manager</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Puntos", stats.totalPoints],
                ["Mejor J", stats.bestMatchday],
                ["Ligas", stats.leagueCount],
                ["Plantilla", formatMoney(stats.squadValue)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white/[0.05] p-3">
                  <div className="text-xs font-bold text-slate-400">{label}</div>
                  <div className="mt-1 truncate text-xl font-black text-white">{value}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-base font-black text-white">Historial de fichajes</h2>
            <div className="space-y-2">
              {transfers
                .filter((transfer) => transfer.userId === userId)
                .slice(0, 10)
                .map((transfer) => (
                  <div key={transfer.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">{transfer.playerName}</div>
                      <div className="text-xs text-slate-500">{transfer.type}</div>
                    </div>
                    <div className="text-sm font-black text-sky-200">{formatMoney(transfer.amount)}</div>
                  </div>
                ))}
              {transfers.filter((transfer) => transfer.userId === userId).length === 0 ? (
                <p className="text-sm text-slate-400">Todavia no tienes movimientos registrados.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
};
