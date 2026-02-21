import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { SessionView } from '../../entities/auth/model/types';
import {
  authGetSession,
  authLogin,
  authLogout,
  MessagingClientError,
} from '../../shared/lib/messaging/client';

type AuthContextValue = {
  session: SessionView;
  isInitializing: boolean;
  isWorking: boolean;
  error: string | null;
  clearError: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const loggedOutSession: SessionView = {
  isAuthenticated: false,
  user: null,
  expiresAt: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof MessagingClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionView>(loggedOutSession);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const next = await authGetSession();
      setSession(next);
      if (!next.isAuthenticated) {
        setError(null);
      }
    } catch (err) {
      if (err instanceof MessagingClientError && err.code === 'AUTH_REQUIRED') {
        setSession(loggedOutSession);
        setError(null);
        return;
      }

      setError(toMessage(err, '세션 상태를 확인하지 못했습니다.'));
      setSession(loggedOutSession);
    }
  }, []);

  const login = useCallback(async () => {
    setIsWorking(true);
    setError(null);
    try {
      const next = await authLogin();
      setSession(next);
    } catch (err) {
      setSession(loggedOutSession);
      setError(toMessage(err, '로그인에 실패했습니다.'));
    } finally {
      setIsWorking(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsWorking(true);
    setError(null);
    try {
      await authLogout();
      setSession(loggedOutSession);
    } catch (err) {
      setError(toMessage(err, '로그아웃에 실패했습니다.'));
    } finally {
      setIsWorking(false);
    }
  }, []);

  useEffect(() => {
    let unmounted = false;

    const bootstrap = async () => {
      await refreshSession();
      if (!unmounted) {
        setIsInitializing(false);
      }
    };

    void bootstrap();

    return () => {
      unmounted = true;
    };
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isInitializing,
      isWorking,
      error,
      clearError,
      login,
      logout,
      refreshSession,
    }),
    [session, isInitializing, isWorking, error, clearError, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
