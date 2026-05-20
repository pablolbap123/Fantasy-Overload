import { Navigate, useParams } from "react-router-dom";

export const LeagueDashboardPage = () => {
  const { leagueId } = useParams();
  return <Navigate to={`/league/${leagueId}/home`} replace />;
};
