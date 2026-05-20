import type { Match, Team } from "../../types";
import { formatDate } from "../../utils/formatters";
import { Card } from "../ui/Card";
import { TeamBadge } from "../teams/TeamBadge";

export const MatchCard = ({ match, teams, onClick }: { match: Match; teams: Team[]; onClick?: () => void }) => {
  const home = teams.find((team) => team.id === match.homeTeamId);
  const away = teams.find((team) => team.id === match.awayTeamId);
  return (
    <button className="block w-full text-left" onClick={onClick}>
      <Card className="transition hover:border-sky-300/30 hover:bg-white/[0.075]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <TeamBadge team={home} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{match.homeTeamName}</div>
              <div className="truncate text-sm font-bold text-white">{match.awayTeamName}</div>
            </div>
            <TeamBadge team={away} size="sm" />
          </div>
          <div className="text-right">
            {match.status === "finalizada" ? (
              <div className="text-2xl font-black text-white">
                {match.homeScore}-{match.awayScore}
              </div>
            ) : (
              <div className="text-sm font-semibold text-sky-200">{match.status === "en_curso" ? "En directo" : "Pendiente"}</div>
            )}
            <div className="text-xs text-slate-500">{formatDate(match.playedAt)}</div>
          </div>
        </div>
      </Card>
    </button>
  );
};
