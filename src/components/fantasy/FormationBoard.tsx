import { clsx } from "clsx";
import { Crown, Eye } from "lucide-react";
import type { Formation, Player } from "../../types";
import { formationShape } from "../../utils/calculatePoints";
import { positionTone } from "../../utils/formatters";
import { availabilityText, isUnavailableForMatchday, playerMatchdayPoints } from "../../utils/playerAvailability";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { Badge } from "../ui/Badge";

interface FormationBoardProps {
  formation: Formation;
  players: Player[];
  starterIds: string[];
  onPlayerClick?: (playerId: string) => void;
  onPlayerDetail?: (player: Player) => void;
  matchdayNumber?: number;
  readOnly?: boolean;
  captainPlayerId?: string | null;
  onCaptainChange?: (playerId: string) => void;
}

const pointsBadgeClass = (pts: number) => {
  if (pts > 0) return "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/30";
  if (pts < 0) return "bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/30";
  return "bg-amber-500/25 text-amber-200 ring-1 ring-amber-400/30";
};

export const FormationBoard = ({
  formation,
  players,
  starterIds,
  onPlayerClick,
  onPlayerDetail,
  matchdayNumber,
  readOnly,
  captainPlayerId,
  onCaptainChange,
}: FormationBoardProps) => {
  const shape = formationShape[formation];
  const uniqueStarterIds = Array.from(new Set(starterIds));
  const rows = [
    uniqueStarterIds.map((id) => players.find((player) => player.id === id)).filter((player) => player?.position === "DEL"),
    uniqueStarterIds.map((id) => players.find((player) => player.id === id)).filter((player) => player?.position === "MED"),
    uniqueStarterIds.map((id) => players.find((player) => player.id === id)).filter((player) => player?.position === "DEF"),
    uniqueStarterIds.map((id) => players.find((player) => player.id === id)).filter((player) => player?.position === "POR"),
  ] as Player[][];

  return (
    <div className="relative max-w-full overflow-hidden rounded-lg border border-emerald-300/20 bg-emerald-950/35 p-2 shadow-2xl shadow-black/25 sm:p-3">
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(90deg,transparent_49%,rgba(255,255,255,.35)_50%,transparent_51%),linear-gradient(0deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:100%_100%,100%_24%]" />
      <div className="relative z-10 space-y-4 py-2 sm:space-y-5">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex min-h-16 min-w-0 items-center justify-center gap-1 sm:gap-2">
            {row.map((player) => {
              const isCaptain = captainPlayerId === player.id;
              const pts = typeof matchdayNumber === "number" ? playerMatchdayPoints(player, matchdayNumber) : null;
              return (
                <div key={player.id} className="relative w-[clamp(3.35rem,17vw,4.7rem)] shrink">
                  {/* Points badge on top */}
                  {pts !== null && (
                    <div className={clsx("absolute -top-3 left-1/2 z-20 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[11px] font-black", pointsBadgeClass(pts))}>
                      {isCaptain ? pts * 2 : pts}
                      {isCaptain && <Crown className="ml-0.5 inline h-2.5 w-2.5 text-amber-300" />}
                    </div>
                  )}

                  {/* Captain crown indicator */}
                  {isCaptain && (
                    <div className="absolute -top-1 -right-1 z-30 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow-lg">
                      <Crown className="h-2.5 w-2.5 text-amber-900" />
                    </div>
                  )}

                  <button
                    className={clsx(
                      "w-full rounded-lg border p-1.5 text-center shadow-xl transition hover:-translate-y-0.5 sm:p-2",
                      isCaptain
                        ? "border-amber-400/50 bg-amber-950/70 hover:border-amber-400/70"
                        : "border-emerald-300/15 bg-slate-950/90 hover:border-emerald-300/35 hover:bg-slate-900",
                      onPlayerClick && !readOnly && "cursor-pointer",
                    )}
                    onClick={() => {
                      if (!readOnly) onPlayerClick?.(player.id);
                    }}
                  >
                    <div className="mb-1 flex justify-center">
                      <PlayerAvatar player={player} size="sm" />
                    </div>
                    <div className="truncate text-[11px] font-bold text-white">{player.name}</div>
                    <Badge className={`${positionTone[player.position]} mt-1 px-1.5 py-0 text-[10px]`}>{player.position}</Badge>
                    {isUnavailableForMatchday(player, matchdayNumber ?? 0) && matchdayNumber ? (
                      <div className="mt-1 rounded-md bg-rose-500/15 px-1 py-0.5 text-[10px] font-black text-rose-200" title={availabilityText(player, matchdayNumber)}>
                        No disponible
                      </div>
                    ) : null}
                  </button>

                  {/* Set captain button */}
                  {!readOnly && onCaptainChange && (
                    <button
                      type="button"
                      aria-label={isCaptain ? "Quitar capitán" : `Hacer capitán a ${player.name}`}
                      className={clsx(
                        "absolute left-1 top-1 rounded-md p-1 transition",
                        isCaptain ? "bg-amber-400/30 text-amber-300 hover:bg-amber-400/50" : "bg-white/10 text-slate-400 hover:bg-white/20 hover:text-amber-300",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCaptainChange(player.id);
                      }}
                    >
                      <Crown className="h-2.5 w-2.5" />
                    </button>
                  )}

                  {onPlayerDetail ? (
                    <button
                      type="button"
                      aria-label={`Ver detalle de ${player.name}`}
                      className="absolute right-1 top-1 rounded-md bg-white/10 p-1 text-slate-200 hover:bg-white/20 hover:text-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        onPlayerDetail(player);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, Object.values(shape)[3 - rowIndex] - row.length) }).map((_, index) => (
              <div key={index} className="w-[clamp(3.35rem,17vw,4.7rem)] shrink rounded-lg border border-dashed border-emerald-300/15 bg-emerald-300/[0.03] p-1.5 text-center sm:p-2">
                <div className="mx-auto h-8 w-8 rounded-lg bg-emerald-300/5" />
                <div className="mt-2 text-[11px] text-slate-500">Libre</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
