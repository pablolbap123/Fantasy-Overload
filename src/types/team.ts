import type { Player } from "./player";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  badgeUrl?: string;
  color: string;
  strength: number;
  players?: Player[];
}
