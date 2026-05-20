import { challengePlayers } from "./challengeData";
import type { Player } from "../types";

export const mockPlayers: Player[] = challengePlayers;

export const getPlayerById = (playerId: string) => mockPlayers.find((player) => player.id === playerId);
