import type { AuthTokens, SessionView } from '../../../../entities/auth/model/types';
import { createBackgroundError } from '../../../../shared/lib/messaging/background-errors';
import type {
  AuthSessionService,
  OAuthClient,
  RefreshTokenStore,
} from './session.types';

const DEFAULT_ACCESS_TOKEN_SKEW_MS = 60 * 1000;

interface CreateAuthSessionServiceOptions {
  oauthClient: OAuthClient;
  refreshTokenStore: RefreshTokenStore;
  getExpiryFromToken: (accessToken: string) => number | null;
  getUserFromToken: (accessToken: string) => SessionView['user'];
  now?: () => number;
  accessTokenSkewMs?: number;
}

export function createAuthSessionService({
  oauthClient,
  refreshTokenStore,
  getExpiryFromToken,
  getUserFromToken,
  now = () => Date.now(),
  accessTokenSkewMs = DEFAULT_ACCESS_TOKEN_SKEW_MS,
}: CreateAuthSessionServiceOptions): AuthSessionService {
  let accessTokenMemory: string | null = null;
  let accessTokenExpiresAtMemory: number | null = null;
  let userMemory: SessionView['user'] = null;

  const getLoggedOutView = (): SessionView => ({
    isAuthenticated: false,
    user: null,
    expiresAt: null,
  });

  const getAuthenticatedView = (): SessionView => ({
    isAuthenticated: true,
    user: userMemory,
    expiresAt: accessTokenExpiresAtMemory,
  });

  const hasUsableAccessToken = (): boolean => {
    if (!accessTokenMemory || !accessTokenExpiresAtMemory) {
      return false;
    }

    return now() + accessTokenSkewMs < accessTokenExpiresAtMemory;
  };

  const setAccessMemory = (tokens: AuthTokens): void => {
    accessTokenMemory = tokens.accessToken;
    accessTokenExpiresAtMemory =
      getExpiryFromToken(tokens.accessToken) ?? now() + tokens.expiresIn * 1000;
    userMemory = getUserFromToken(tokens.accessToken);
  };

  const applyTokens = async (tokens: AuthTokens): Promise<void> => {
    setAccessMemory(tokens);
    if (tokens.refreshToken) {
      await refreshTokenStore.write(tokens.refreshToken);
    }
  };

  const clearSession = async (): Promise<void> => {
    accessTokenMemory = null;
    accessTokenExpiresAtMemory = null;
    userMemory = null;
    await refreshTokenStore.clear();
  };

  const forceRefreshAccessToken = async (): Promise<string> => {
    const refreshToken = await refreshTokenStore.read();
    if (!refreshToken) {
      await clearSession();
      throw createBackgroundError('AUTH_REQUIRED', 'A login session is required.');
    }

    try {
      const tokens = await oauthClient.refresh(refreshToken);
      await applyTokens(tokens);
      return tokens.accessToken;
    } catch {
      await clearSession();
      throw createBackgroundError('AUTH_REQUIRED', 'Session expired. Please login again.');
    }
  };

  return {
    initializeSessionStoragePolicy: async () => {
      await refreshTokenStore.initializePolicy?.();
    },
    clearSession,
    ensureAccessToken: async () => {
      if (hasUsableAccessToken()) {
        return accessTokenMemory as string;
      }
      return forceRefreshAccessToken();
    },
    forceRefreshAccessToken,
    loginSession: async () => {
      const tokens = await oauthClient.login();
      await applyTokens(tokens);
      return getAuthenticatedView();
    },
    logoutSession: async () => {
      await clearSession();
    },
    getSessionView: async () => {
      if (hasUsableAccessToken()) {
        return getAuthenticatedView();
      }

      const refreshToken = await refreshTokenStore.read();
      if (!refreshToken) {
        return getLoggedOutView();
      }

      try {
        await forceRefreshAccessToken();
        return getAuthenticatedView();
      } catch {
        return getLoggedOutView();
      }
    },
  };
}
