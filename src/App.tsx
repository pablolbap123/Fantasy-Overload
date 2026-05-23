import type { ReactElement } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { LoadingScreen } from "./components/ui/LoadingScreen";
import { ToastHost } from "./components/ui/ToastHost";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { AuthPage } from "./pages/AuthPage";
<<<<<<< HEAD
=======
import { BudgetPage } from "./pages/BudgetPage";
>>>>>>> 6bc6cc2 (Version 2.2)
import { CreateLeaguePage } from "./pages/CreateLeaguePage";
import { HomePage } from "./pages/HomePage";
import { JoinLeaguePage } from "./pages/JoinLeaguePage";
import { LeagueDashboardPage } from "./pages/LeagueDashboardPage";
import { LeagueSelectPage } from "./pages/LeagueSelectPage";
import { MarketPage } from "./pages/MarketPage";
import { MatchdayPage } from "./pages/MatchdayPage";
import { MembersPage } from "./pages/MembersPage";
import { MyTeamPage } from "./pages/MyTeamPage";
import { AdminPage } from "./pages/AdminPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { StandingsPage } from "./pages/StandingsPage";
import { StatsPage } from "./pages/StatsPage";
import { useFantasy } from "./store/fantasyStore";

const PrivateRoute = ({ children }: { children: ReactElement }) => {
  const { userId, loading } = useFantasy();
  if (loading) return <LoadingScreen />;
  if (!userId) return <Navigate to="/auth" replace />;
  return children;
};

const LeagueGuard = ({ children }: { children: ReactElement }) => {
  const { currentLeague, leagues, loading } = useFantasy();
  const { leagueId } = useParams();
  if (loading) return <LoadingScreen />;
  if (!currentLeague && leagues.length === 0) return <Navigate to="/leagues" replace />;
  if (leagueId && leagues.length > 0 && !leagues.some((league) => league.id === leagueId)) {
    return <NotFoundPage message="La liga de esta URL no existe o no perteneces a ella." />;
  }
  return children;
};

export default function App() {
  const { loading, userId, leagues, currentLeague } = useFantasy();

  if (loading) return <LoadingScreen />;

  const defaultPath = userId
    ? currentLeague
      ? `/league/${currentLeague.id}/home`
      : leagues[0]
        ? `/league/${leagues[0].id}/home`
        : "/leagues"
    : "/auth";

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={defaultPath} replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/leagues"
          element={
            <PrivateRoute>
              <LeagueSelectPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/leagues/create"
          element={
            <PrivateRoute>
              <CreateLeaguePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/leagues/join"
          element={
            <PrivateRoute>
              <JoinLeaguePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <ProfilePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/league/:leagueId"
          element={
            <PrivateRoute>
              <LeagueGuard>
                <AppShell />
              </LeagueGuard>
            </PrivateRoute>
          }
        >
          <Route index element={<LeagueDashboardPage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="team" element={<MyTeamPage />} />
<<<<<<< HEAD
=======
          <Route path="budget" element={<BudgetPage />} />
>>>>>>> 6bc6cc2 (Version 2.2)
          <Route path="market" element={<MarketPage />} />
          <Route path="matchday" element={<MatchdayPage />} />
          <Route path="standings" element={<StandingsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <ToastHost />
    </>
  );
}
