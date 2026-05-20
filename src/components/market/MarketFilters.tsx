/* eslint-disable react-refresh/only-export-components */
import { Filter } from "lucide-react";
import type { PlayerPosition, PlayerStatus, Team } from "../../types";
import { formatMoney } from "../../utils/formatters";
import { Card } from "../ui/Card";

const positions: Array<"todos" | PlayerPosition> = ["todos", "POR", "DEF", "MED", "DEL"];
const statuses: Array<"todos" | PlayerStatus> = ["todos", "disponible", "duda", "lesionado", "sancionado"];

interface MarketFiltersProps {
  position: "todos" | PlayerPosition;
  status: "todos" | PlayerStatus;
  teamId: string;
  sortBy: string;
  maxPrice: number;
  teams: Team[];
  onPositionChange: (value: "todos" | PlayerPosition) => void;
  onStatusChange: (value: "todos" | PlayerStatus) => void;
  onTeamChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onMaxPriceChange: (value: number) => void;
}

export const MarketFilters = ({
  position,
  status,
  teamId,
  sortBy,
  maxPrice,
  teams,
  onPositionChange,
  onStatusChange,
  onTeamChange,
  onSortChange,
  onMaxPriceChange,
}: MarketFiltersProps) => (
  <Card>
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
        <option value="points">Más puntos</option>
        <option value="price">Más caros</option>
        <option value="name">Nombre</option>
      </select>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Filter className="h-4 w-4 text-slate-500" />
      <input
        className="w-52 accent-sky-300"
        type="range"
        min={2_000_000}
        max={120_000_000}
        step={1_000_000}
        value={maxPrice}
        onChange={(event) => onMaxPriceChange(Number(event.target.value))}
      />
      <span className="text-sm text-slate-300">Precio máximo {formatMoney(maxPrice)}</span>
    </div>
  </Card>
);

export const marketFilterOptions = { positions, statuses };
