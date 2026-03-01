import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./lib/store";
import { AppLayout } from "./components/app-layout";
import { LoginPage } from "./pages/login";
import { RegisterPage } from "./pages/register";
import { DashboardPage } from "./pages/dashboard";
import { AgentsPage } from "./pages/agents";
import { NewAgentPage } from "./pages/agents-new";
import { AgentDetailPage } from "./pages/agent-detail";
import { AgentEditPage } from "./pages/agent-edit";
import { RunsPage } from "./pages/runs";
import { RunDetailPage } from "./pages/run-detail";
import { SkillsPage } from "./pages/skills";
import { ApiKeysPage } from "./pages/api-keys";
import { SchedulesPage } from "./pages/schedules";
import { TeamsPage } from "./pages/teams";
import AuditLogPage from "./pages/audit-log";
import CredentialsPage from "./pages/credentials";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { loadUser } = useAuth();
  useEffect(() => { loadUser(); }, [loadUser]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/agents/new" element={<NewAgentPage />} />
                <Route path="/agents/:id" element={<AgentDetailPage />} />
                <Route path="/agents/:id/edit" element={<AgentEditPage />} />
                <Route path="/runs" element={<RunsPage />} />
                <Route path="/runs/:id" element={<RunDetailPage />} />
                <Route path="/skills" element={<SkillsPage />} />
                <Route path="/schedules" element={<SchedulesPage />} />
                <Route path="/teams" element={<TeamsPage />} />
                <Route path="/audit-log" element={<AuditLogPage />} />
                <Route path="/settings/api-keys" element={<ApiKeysPage />} />
                <Route path="/settings/credentials" element={<CredentialsPage />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
