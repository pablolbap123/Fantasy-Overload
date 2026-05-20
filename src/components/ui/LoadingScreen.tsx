import { Loader2 } from "lucide-react";

export const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-pitch-950 text-white">
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4">
      <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
      <span className="text-sm font-medium">Cargando Overload Fantasy</span>
    </div>
  </div>
);
