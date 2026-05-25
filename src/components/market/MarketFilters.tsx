/* eslint-disable react-refresh/only-export-components */
import { Filter } from "lucide-react";
import type { PlayerPosition, PlayerStatus, Team } from "../../types";
import { Card } from "../ui/Card";

const positions: Array<"todos" | PlayerPosition> = ["todos", "POR", "DEF", "MED", "DEL"];
const statuses: Array<"todos" | PlayerStatus> = ["todos", "disponible", "duda", "lesionado", "sancionado"];

interface MarketFiltersProps {
  position: "todos" | PlayerPosition;
  status: "todos" | PlayerStatus;
  teamId: string;
  sortBy: string;
  teams: Team[];
  onPositionChange: (value: "todos" | PlayerPosition) => void;
  onStatusChange: (value: "todos" | PlayerStatus) => void;
  onTeamChange: (value: string) => void;
  onSortChange: (value: string) => void;
}

export const MarketFilters = ({
  position,
  status,
  teamId,
  sortBy,
  teams,
  onPositionChange,
  onStatusChange,
  onTeamChange,
  onSortChange,
}: MarketFiltersProps) => (
  <Card className="border-[#62d7ff]/15 bg-[#101b27]/95">
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#62d7ff]/15 text-[#9be9ff]">
        <Filter className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-black text-white">Filtros del mercado</div>
        <div className="text-xs font-semibold text-slate-400">Solo jugadores con club. La Bolsa queda fuera del mercado.</div>
      </div>
    </div>
    <div className="grid gap-3 md:grid-cols-4">
      <select className="field" value={position} onChange={(event) => onPositionChange(event.target.value as "todos" | PlayerPosition)}>
        {positions.map((item) => (
          <option key={item} value={item}>
            {item === "todos" ? "Todas posiciones" : item}
          </option>
        ))}
      </select>
      <select className="field" value={status} onChange={(event) => onStatusChange(event.target.value as "todos" | PlayerStatus)}>
        {statuses.map((item) => (
          <option key={item} value={item}>
            {item === "todos" ? "Todos estados" : item}
          </option>
        ))}
      </select>
      <select className="field" value={teamId} onChange={(event) => onTeamChange(event.target.value)}>
        <option value="todos">Todos equipos</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <select className="field" value={sortBy} onChange={(event) => onSortChange(event.target.value)}>
        <option value="points">Mas puntos</option>
        <option value="price">Mas caros</option>
        <option value="name">Nombre</option>
      </select>
    </div>
  </Card>
);

export const marketFilterOptions = { positions, statuses };
