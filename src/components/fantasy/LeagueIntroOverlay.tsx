import { AnimatePresence, motion } from "framer-motion";
import { clsx } from "clsx";
import { ChevronRight, PackageOpen, Sparkles, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LeaguePlayer, Player } from "../../types";
import { formatMoney, positionTone } from "../../utils/formatters";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface LeagueIntroOverlayProps {
  leagueId?: string;
  userId?: string | null;
  players: Player[];
  leaguePlayers: LeaguePlayer[];
}

const rememberIntro = (key: string) => {
  try {
    localStorage.setItem(key, "seen");
  } catch {
    // Local preference only; the game state still lives in Supabase.
  }
};

const hasSeenIntro = (key: string) => {
  try {
    return localStorage.getItem(key) === "seen";
  } catch {
    return false;
  }
};

const positionOrder = { POR: 0, DEF: 1, MED: 2, DEL: 3 } as const;

export const LeagueIntroOverlay = ({ leagueId, userId, players, leaguePlayers }: LeagueIntroOverlayProps) => {
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const storageKey = leagueId && userId ? `overload:starter-pack:v3:${leagueId}:${userId}` : "";

  const revealPlayers = useMemo(() => {
    const myPlayerIds = new Set(leaguePlayers.filter((item) => item.ownerUserId === userId).map((item) => item.playerId));
    return players
      .filter((player) => myPlayerIds.has(player.id))
      .sort((a, b) =>
        positionOrder[a.position] === positionOrder[b.position]
          ? b.totalPoints - a.totalPoints || b.currentPrice - a.currentPrice
          : positionOrder[a.position] - positionOrder[b.position],
      );
  }, [leaguePlayers, players, userId]);

  useEffect(() => {
    if (!storageKey || revealPlayers.length === 0) return;
    if (!hasSeenIntro(storageKey)) {
      setCurrentIndex(0);
      setOpen(true);
    }
  }, [revealPlayers.length, storageKey]);

  useEffect(() => {
    if (!open || currentIndex >= revealPlayers.length - 1) return;
    const timeout = window.setTimeout(() => {
      setCurrentIndex((index) => Math.min(index + 1, revealPlayers.length - 1));
    }, currentIndex === 0 ? 1200 : 1550);
    return () => window.clearTimeout(timeout);
  }, [currentIndex, open, revealPlayers.length]);

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  const close = () => {
    if (storageKey) rememberIntro(storageKey);
    setOpen(false);
  };

  const openNext = () => setCurrentIndex((index) => Math.min(index + 1, revealPlayers.length - 1));

  const currentPlayer = revealPlayers[currentIndex];
  const openedPlayers = revealPlayers.slice(0, currentIndex + 1);
  const packComplete = currentIndex >= revealPlayers.length - 1;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-slate-950/92 px-3 py-3 backdrop-blur-xl sm:px-5 sm:py-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex h-[min(760px,calc(100dvh-1.5rem))] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-emerald-300/20 bg-slate-950 shadow-2xl shadow-emerald-950/30"
            initial={{ scale: 0.97, y: 14 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 8 }}
            transition={{ duration: 0.22 }}
          >
            <div className="shrink-0 border-b border-emerald-300/10 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-turbo-gold/25 bg-turbo-gold/10 px-3 py-1 text-xs font-black text-turbo-gold">
                    <Sparkles className="h-4 w-4" />
                    Temporada 1 GO
                  </div>
                  <h2 className="mt-3 truncate text-xl font-black text-white sm:text-2xl">Tu plantilla inicial</h2>
                </div>
                <button
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  onClick={close}
                  aria-label="Cerrar presentacion"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-sky-300 to-turbo-gold"
                  initial={false}
                  animate={{ width: `${((currentIndex + 1) / revealPlayers.length) * 100}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-3 p-3 sm:gap-4 sm:p-5 md:grid-cols-2">
              <div className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-lg border border-sky-300/10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,.18),transparent_55%),rgba(255,255,255,.035)] p-4">
                <div className="pointer-events-none absolute inset-x-8 top-8 h-24 rounded-full bg-emerald-300/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full bg-sky-300/10 blur-2xl" />

                {currentPlayer ? (
                  <motion.article
                    key={currentPlayer.id}
                    className="relative w-full max-w-[300px] sm:max-w-[340px]"
                    initial={{ opacity: 0.88, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 230, damping: 22 }}
                  >
                    <motion.div
                      className="absolute -inset-3 rounded-lg bg-gradient-to-br from-emerald-300/20 via-sky-300/10 to-turbo-gold/20 blur-xl"
                      animate={{ opacity: [0.45, 0.8, 0.45], scale: [0.98, 1.03, 0.98] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <div className="relative overflow-hidden rounded-lg border border-white/12 bg-slate-900/95 shadow-2xl shadow-black/30">
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.13),transparent)] opacity-40" />
                      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                        <div className="flex items-center gap-2 text-xs font-black uppercase text-turbo-gold">
                          <PackageOpen className="h-4 w-4" />
                          Sobre {currentIndex + 1}/{revealPlayers.length}
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                          <Star className="h-3.5 w-3.5 text-turbo-gold" />
                          Inicial
                        </div>
                      </div>
                      <div className="p-4 text-center sm:p-6">
                        <motion.div
                          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-slate-950/70 ring-1 ring-emerald-300/20"
                          initial={{ rotate: -3, scale: 0.9 }}
                          animate={{ rotate: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.04 }}
                        >
                          <div className="scale-125">
                            <PlayerAvatar player={currentPlayer} size="lg" />
                          </div>
                        </motion.div>
                        <div className="truncate text-xl font-black text-white sm:text-2xl">{currentPlayer.name}</div>
                        <div className="mt-1 truncate text-sm text-slate-400">{currentPlayer.teamName}</div>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:mt-5">
                          <Badge className={positionTone[currentPlayer.position]}>{currentPlayer.position}</Badge>
                          <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-sm font-black text-emerald-100">
                            {currentPlayer.totalPoints} pts
                          </span>
                          <span className="rounded-full bg-sky-300/10 px-3 py-1 text-sm font-black text-sky-100">
                            {formatMoney(currentPlayer.currentPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                ) : null}
              </div>

              <div className="min-h-0 rounded-lg border border-white/10 bg-white/[0.035] p-3 max-md:hidden">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-300">Lote descubierto</h3>
                    <p className="text-xs text-slate-500">Sin scroll: los 15 quedan a la vista.</p>
                  </div>
                  <Badge className="bg-emerald-400/15 text-emerald-100 ring-emerald-300/25">
                    {openedPlayers.length}/{revealPlayers.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {revealPlayers.map((player, index) => {
                    const discovered = index <= currentIndex;
                    return (
                      <motion.div
                        key={player.id}
                        className={clsx(
                          "relative flex h-12 min-w-0 flex-col items-center justify-center rounded-lg border p-1 text-center transition sm:h-14 sm:p-1.5 md:h-16",
                          discovered
                            ? "border-emerald-300/20 bg-slate-900/90 text-white"
                            : "border-white/5 bg-slate-900/35 text-slate-600",
                        )}
                        initial={false}
                        animate={discovered ? { opacity: 1, scale: 1 } : { opacity: 0.55, scale: 0.98 }}
                      >
                        {discovered ? (
                          <>
                            <PlayerAvatar player={player} size="sm" />
                            <span className="mt-1 hidden max-w-full truncate px-1 text-[10px] font-black leading-none md:block">{player.name}</span>
                            <span
                              className={clsx(
                                "absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none",
                                positionTone[player.position],
                              )}
                            >
                              {player.position}
                            </span>
                          </>
                        ) : (
                          <PackageOpen className="h-5 w-5 text-slate-600" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-emerald-300/10 p-3 sm:justify-between sm:p-5">
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-white">{packComplete ? "Plantilla lista" : "Abriendo sobres"}</p>
                <p className="text-xs text-slate-500">{packComplete ? "Ya puedes entrar a gestionar tu once." : "Puedes saltarlo cuando quieras."}</p>
              </div>
              <div className="flex gap-2">
                {!packComplete ? (
                  <Button variant="secondary" icon={<ChevronRight className="h-4 w-4" />} onClick={openNext}>
                    Abrir siguiente
                  </Button>
                ) : null}
                <Button onClick={close}>{packComplete ? "Entrar a la liga" : "Saltar sobres"}</Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
