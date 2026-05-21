import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";

export const NotFoundPage = ({ message = "No encontramos esta pagina o liga." }: { message?: string }) => (
  <main className="flex min-h-screen items-center justify-center px-4 py-8">
    <Card className="w-full max-w-lg p-6 text-center">
      <div className="text-5xl font-black text-[#f5bd43]">404</div>
      <h1 className="mt-3 text-2xl font-black text-white">Ruta no encontrada</h1>
      <p className="mt-2 text-sm text-slate-300">{message}</p>
      <Link className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#62d7ff] px-4 text-sm font-black text-[#08101f]" to="/leagues">
        Ir a mis ligas
      </Link>
    </Card>
  </main>
);
