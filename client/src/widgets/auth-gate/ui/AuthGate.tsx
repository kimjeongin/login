import { useAuth } from '../../../app/providers/AuthProvider';
import { API_BASE_URL, KEYCLOAK_AUTH_URL } from '../../../shared/config/env';
import { Card, CardContent } from '../../../shared/ui/card';
import { LoginCard } from '../../../features/auth/login/ui/LoginCard';
import { ProjectDashboard } from '../../project-dashboard/ui/ProjectDashboard';

export function AuthGate() {
  const {
    session,
    isInitializing,
    isWorking,
    error,
    clearError,
    login,
  } = useAuth();

  if (isInitializing) {
    return (
      <Card className="w-full">
        <CardContent className="pt-5 text-center text-sm text-slate-600">
          세션 확인 중...
        </CardContent>
      </Card>
    );
  }

  if (!session.isAuthenticated) {
    return (
      <LoginCard
        isLoading={isWorking}
        error={error}
        authHint={`Auth: ${KEYCLOAK_AUTH_URL}`}
        apiHint={`Backend: ${API_BASE_URL}`}
        onLogin={login}
        onClearError={clearError}
      />
    );
  }

  return <ProjectDashboard />;
}
