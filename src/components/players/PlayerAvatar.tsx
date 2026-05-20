import type { Player } from "../../types";

export const PlayerAvatar = ({ player, size = "md" }: { player: Player; size?: "sm" | "md" | "lg" }) => {
  const dimensions = size === "lg" ? "h-14 w-14 text-base" : size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  if (player.imageUrl) {
    return (
      <img
        src={player.imageUrl}
        alt={player.name}
        className={`${dimensions} shrink-0 rounded-lg object-cover ring-1 ring-emerald-300/20`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 font-black text-emerald-100 ring-1 ring-emerald-300/15`}
    >
      {player.name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")}
    </div>
  );
};
