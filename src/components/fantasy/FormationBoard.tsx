import { clsx } from "clsx";
import { Crown, Eye } from "lucide-react";
import type { Formation, LineupPlayer, Player, PlayerPosition } from "../../types";
import { assignLineupPositions, formationShape, normalizePlayerPosition, playerPositions } from "../../utils/calculatePoints";
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
  lineupPlayers?: LineupPlayer[];
}

const rowPositions: PlayerPosition[] = ["DEL", "MED", "DEF", "POR"];

const pointsBadgeClass = (pts: number) => {
  if (pts > 0) return "bg-emerald-500 text-white";
  if (pts < 0) return "bg-rose-500 text-white";
  return "bg-amber-400 text-slate-950";
};

const emptyCounts = () => ({ POR: 0, DEF: 0, MED: 0, DEL: 0 }) satisfies Record<PlayerPosition, number>;

const storedAssignmentFor = (lineupPlayers: LineupPlayer[] | undefined, players: Player[], starterIds: string[], formation: Formation) => {
  if (!lineupPlayers?.length) return null;
  const shape = formationShape[formation];
  const byPlayer = new Map(lineupPlayers.map((lineupPlayer) => [lineupPlayer.playerId, lineupPlayer]));
  const assignment: Record<string, PlayerPosition> = {};
  const counts = emptyCounts();

  for (const playerId of starterIds) {
    const player = players.find((item) => item.id === playerId);
    const stored = byPlayer.get(playerId);
    if (!player || !stored) return null;
    const position = normalizePlayerPosition(stored.position, normalizePlayerPosition(player.position));
    assignment[playerId] = position;
    counts[position] += 1;
  }

  return rowPositions.every((position) => counts[position] === shape[position]) ? assignment : null;
};

const fallbackAssignmentFor = (players: Player[], starterIds: string[], formation: Formation) => {
  const shape = formationShape[formation];
  const remaining = { ...shape };
  const assignment: Record<string, PlayerPosition> = {};
  const starters = starterIds.map((id) => players.find((player) => player.id === id)).filter(Boolean) as Player[];

  for (const position of rowPositions) {
    for (const player of starters) {
      if (remaining[position] <= 0) break;
      if (assignment[player.id] || !playerPositions(player).includes(position)) continue;
      assignment[player.id] = position;
      remaining[position] -= 1;
    }
  }

  for (const player of starters) {
    if (assignment[player.id]) continue;
    const openPosition = rowPositions.find((position) => remaining[position] > 0);
    assignment[player.id] = openPosition ?? normalizePlayerPosition(player.position);
    if (openPosition) remaining[openPosition] -= 1;
  }

  return assignment;
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
  lineupPlayers,
}: FormationBoardProps) => {
  const shape = formationShape[formation];
  const uniqueStarterIds = Array.from(new Set(starterIds));
  const assignedPositions =
    storedAssignmentFor(lineupPlayers, players, uniqueStarterIds, formation) ??
    assignLineupPositions(players, uniqueStarterIds, formation) ??
    fallbackAssignmentFor(players, uniqueStarterIds, formation);
  const boardPlayers = uniqueStarterIds
    .map((id) => {
      const player = players.find((item) => item.id === id);
      if (!player) return null;
      return { player, assignedPosition: assignedPositions[id] ?? normalizePlayerPosition(player.position) };
    })
    .filter(Boolean) as Array<{ player: Player; assignedPosition: PlayerPosition }>;
  const rows = rowPositions.map((position) => boardPlayers.filter((item) => item.assignedPosition === position));

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-[#103f2b] p-2 shadow-lg shadow-black/25 sm:p-3">
      <div className="absolute inset-2 rounded-[0.55rem] border border-white/20" />
      <div className="absolute left-1/2 top-2 h-[calc(100%-1rem)] w-px -translate-x-1/2 bg-white/15" />
      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
      <div className="absolute inset-x-10 top-2 h-14 rounded-b-full border-x border-b border-white/15" />
      <div className="absolute inset-x-10 bottom-2 h-14 rounded-t-full border-x border-t border-white/15" />
      <div className="relative z-10 flex min-h-[31rem] flex-col justify-between gap-3 py-4 sm:min-h-[35rem] sm:gap-5 sm:py-5">
        {rows.map((row, rowIndex) => (
          <div key={rowPositions[rowIndex]} className="flex min-w-0 items-center justify-center gap-1.5 sm:gap-3">
            {row.map(({ player, assignedPosition }) => {
              const isCaptain = captainPlayerId === player.id;
              const pts = typeof matchdayNumber === "number" ? playerMatchdayPoints(player, matchdayNumber) : null;
              const displayPts = pts !== null && isCaptain ? pts * 2 : pts;
              return (
                <div key={player.id} className="relative w-[4.1rem] flex-none min-[390px]:w-[4.7rem] sm:w-24">
                  {displayPts !== null && (
                    <div className={clsx("absolute -top-2 left-1/2 z-20 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-black shadow-sm sm:text-[11px]", pointsBadgeClass(displayPts))}>
                      {displayPts}
                      {isCaptain && <Crown className="ml-0.5 inline h-2.5 w-2.5 text-amber-200" />}
                    </div>
                  )}

                  {isCaptain ? (
                    <div className="absolute -right-1 -top-1 z-30 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow-lg">
                      <Crown className="h-2.5 w-2.5 text-amber-950" />
                    </div>
                  ) : null}

                  <button
                    className={clsx(
                      "w-full rounded-lg border px-1.5 pb-2 pt-3 text-center shadow-lg transition hover:-translate-y-0.5 sm:p-2 sm:pt-3",
                      isCaptain
                        ? "border-amber-300/70 bg-[#1e2718]/95 hover:border-amber-300"
                        : "border-white/10 bg-[#10161f]/95 hover:border-emerald-300/55 hover:bg-[#141d28]",
                      onPlayerClick && !readOnly && "cursor-pointer",
                    )}
                    onClick={() => {
                      if (!readOnly) onPlayerClick?.(player.id);
                    }}
                  >
                    <div className="mb-1 flex justify-center">
                      <PlayerAvatar player={player} size="sm" />
                    </div>
                    <div className="line-clamp-2 min-h-8 text-[10px] font-black leading-tight text-white sm:text-[11px]">{player.name}</div>
                    <Badge className={`${positionTone[assignedPosition]} mt-1 px-1 py-0 text-[9px] sm:px-1.5 sm:text-[10px]`}>{assignedPosition}</Badge>
                    {isUnavailableForMatchday(player, matchdayNumber ?? 0) && matchdayNumber ? (
                      <div className="mt-1 rounded-md bg-rose-500/15 px-1 py-0.5 text-[10px] font-black text-rose-200" title={availabilityText(player, matchdayNumber)}>
                        No disponible
                      </div>
                    ) : null}
                  </button>

                  {onCaptainChange ? (
                    <button
                      type="button"
                      aria-label={isCaptain ? "Quitar capitan" : `Hacer capitan a ${player.name}`}
                      className={clsx(
                        "absolute left-1 top-1 rounded-md p-1 transition",
                        isCaptain ? "bg-amber-400/30 text-amber-300 hover:bg-amber-400/50" : "bg-white/10 text-slate-400 hover:bg-white/20 hover:text-amber-300",
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCaptainChange(player.id);
                      }}
                    >
                      <Crown className="h-2.5 w-2.5" />
                    </button>
                  ) : null}

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
            {Array.from({ length: Math.max(0, shape[rowPositions[rowIndex]] - row.length) }).map((_, index) => (
              <div key={index} className="w-[4.1rem] flex-none rounded-lg border border-dashed border-white/20 bg-white/[0.04] p-2 text-center min-[390px]:w-[4.7rem] sm:w-24">
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
