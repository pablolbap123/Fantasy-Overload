import type { Team } from "../../types";

export const TeamBadge = ({ team, size = "md" }: { team?: Team; size?: "sm" | "md" }) => {
  const dimensions = size === "sm" ? "h-8 w-8 text-[10px]" : "h-11 w-11 text-xs";
  if (team?.badgeUrl) {
    return (
      <img
        src={team.badgeUrl}
        alt={team.name}
        className={`${dimensions} shrink-0 rounded-xl object-cover bg-white p-0.5 ring-1 ring-white/20`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-xl font-black text-slate-950 ring-1 ring-white/20`}
      style={{ backgroundColor: team?.color ?? "#38bdf8" }}
      title={team?.name}
    >
      {team?.shortName ?? "OS"}
    </div>
  );
};
