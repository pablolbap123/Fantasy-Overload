import { Copy, Share2 } from "lucide-react";
import { useState } from "react";
import type { League } from "../../types";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export const InviteLeagueCard = ({ league }: { league?: League }) => {
  const [copied, setCopied] = useState(false);
  if (!league) return null;

  const inviteUrl = `${window.location.origin}/leagues/join?code=${league.inviteCode}`;

  const copy = async () => {
    await navigator.clipboard.writeText(`Únete a mi liga ${league.name}: ${league.inviteCode}\n${inviteUrl}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: league.name,
        text: `Únete a mi liga fantasy con el código ${league.inviteCode}`,
        url: inviteUrl,
      });
      return;
    }
    await copy();
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-white">Invitar amigos</h2>
          <p className="mt-1 text-sm text-slate-400">
            Comparte este código. Miembros reales: {league.memberCount ?? 0}/{league.maxMembers}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-turbo-gold/35 bg-turbo-gold/10 px-4 py-2 text-xl font-black tracking-[0.22em] text-turbo-gold">
            {league.inviteCode}
          </div>
          <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => void copy()}>
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button icon={<Share2 className="h-4 w-4" />} onClick={() => void share()}>
            Compartir
          </Button>
        </div>
      </div>
    </Card>
  );
};
