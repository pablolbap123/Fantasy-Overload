import { clsx } from "clsx";
import { Eye } from "lucide-react";
import type { Formation, Player } from "../../types";
import { formationShape } from "../../utils/calculatePoints";
import { positionTone } from "../../utils/formatters";
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
}

export const FormationBoard = ({ formation, players, starterIds, onPlayerClick, onPlayerDetail, matchdayNumber, readOnly }: FormationBoardProps) => {
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
            {row.map((player) => (
              <div key={player.id} className="relative w-[clamp(3.35rem,17vw,4.7rem)] shrink">
                <button
                  className={clsx(
                    "w-full rounded-lg border border-emerald-300/15 bg-slate-950/90 p-1.5 text-center shadow-xl transition hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-slate-900 sm:p-2",
                    onPlayerClick && !readOnly && "cursor-pointer",
                  )}
                  onClick={() => {
                    if (!readOnly) onPlayerClick?.(player.id);
                  }}
                >
                  <div className="mb-1 flex justify-center">
                    <PlayerAvatar player={player} size="sm" />
                  </div>
                  <div className="truncate text-[11px] font-bold text-white">{player.name.split(" ").at(-1)}</div>
                  <Badge className={`${positionTone[player.position]} mt-1 px-1.5 py-0 text-[10px]`}>{player.position}</Badge>
                  {typeof matchdayNumber === "number" ? (
                    <div className="mt-1 rounded-md bg-white/10 px-1 py-0.5 text-[10px] font-black text-[#21d17f]">
                      {player.pointsByMatchday[matchdayNumber] ?? 0} pts
                    </div>
                  ) : null}
                </button>
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
            ))}
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
