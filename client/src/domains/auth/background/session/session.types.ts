import type { AuthTokens, SessionView } from '../../../../entities/auth/model/types';

export interface OAuthClient {
  login: () => Promise<AuthTokens>;
  refresh: (refreshToken: string) => Promise<AuthTokens>;
}

export interface RefreshTokenStore {
  read: () => Promise<string | null>;
  write: (refreshToken: string) => Promise<void>;
  clear: () => Promise<void>;
  initializePolicy?: () => Promise<void>;
}

export interface AuthSessionService {
  initializeSessionStoragePolicy: () => Promise<void>;
  clearSession: () => Promise<void>;
  ensureAccessToken: () => Promise<string>;
  forceRefreshAccessToken: () => Promise<string>;
  loginSession: () => Promise<SessionView>;
  logoutSession: () => Promise<void>;
  getSessionView: () => Promise<SessionView>;
}
