import type { Player } from "../types";

export const isHardUnavailable = (player: Player) => player.status === "lesionado" || player.status === "sancionado";

export const isUnavailableForMatchday = (player: Player, matchdayNumber?: number | null) => {
  if (!isHardUnavailable(player)) return false;
  if (!matchdayNumber || !player.unavailableUntilMatchday) return true;
  return matchdayNumber <= player.unavailableUntilMatchday;
};

export const playerMatchdayPoints = (player: Player, matchdayNumber?: number | null) =>
  matchdayNumber && !isUnavailableForMatchday(player, matchdayNumber) ? Number(player.pointsByMatchday[matchdayNumber] ?? 0) : 0;

export const availabilityText = (player: Player, matchdayNumber?: number | null) => {
  if (!isUnavailableForMatchday(player, matchdayNumber)) return "";
  const end = player.unavailableUntilMatchday;
  return end ? `${player.status} hasta J${end}` : player.status;
};
