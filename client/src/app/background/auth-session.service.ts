import { getExpiryFromToken, getUserFromToken } from '../../entities/auth/lib/token';
import type { AuthTokens, SessionView } from '../../entities/auth/model/types';
import { createBackgroundError } from './errors';
import {
  loginWithWebAuthFlow,
  refreshAccessToken,
} from './keycloak-oauth.client';

const REFRESH_TOKEN_STORAGE_KEY = 'auth.refresh-token.v1';
const ACCESS_TOKEN_SKEW_MS = 60 * 1000;

let accessTokenMemory: string | null = null;
let accessTokenExpiresAtMemory: number | null = null;
let userMemory: SessionView['user'] = null;

type SessionStorageArea = {
  get: (
    keys?:
      | string
      | string[]
      | Record<string, unknown>
      | null,
  ) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  setAccessLevel?: (options: {
    accessLevel: 'TRUSTED_CONTEXTS' | 'TRUSTED_AND_UNTRUSTED_CONTEXTS';
  }) => Promise<void>;
};

function getStorageSession(): SessionStorageArea {
  return browser.storage.session as unknown as SessionStorageArea;
}

function getLoggedOutView(): SessionView {
  return {
    isAuthenticated: false,
    user: null,
    expiresAt: null,
  };
}

function getAuthenticatedView(): SessionView {
  return {
    isAuthenticated: true,
    user: userMemory,
    expiresAt: accessTokenExpiresAtMemory,
  };
}

function hasUsableAccessToken(now = Date.now()): boolean {
  if (!accessTokenMemory || !accessTokenExpiresAtMemory) {
    return false;
  }

  return now + ACCESS_TOKEN_SKEW_MS < accessTokenExpiresAtMemory;
}

async function readRefreshToken(): Promise<string | null> {
  const result = await getStorageSession().get(REFRESH_TOKEN_STORAGE_KEY);
  const refreshToken = result[REFRESH_TOKEN_STORAGE_KEY];

  return typeof refreshToken === 'string' && refreshToken.length > 0
    ? refreshToken
    : null;
}

async function writeRefreshToken(refreshToken: string): Promise<void> {
  await getStorageSession().set({
    [REFRESH_TOKEN_STORAGE_KEY]: refreshToken,
  });
}

async function clearRefreshToken(): Promise<void> {
  await getStorageSession().remove(REFRESH_TOKEN_STORAGE_KEY);
}

function setAccessMemory(tokens: AuthTokens): void {
  accessTokenMemory = tokens.accessToken;
  accessTokenExpiresAtMemory =
    getExpiryFromToken(tokens.accessToken) ?? Date.now() + tokens.expiresIn * 1000;
  userMemory = getUserFromToken(tokens.accessToken);
}

async function applyTokens(tokens: AuthTokens): Promise<void> {
  setAccessMemory(tokens);

  if (tokens.refreshToken) {
    await writeRefreshToken(tokens.refreshToken);
  }
}

export async function initializeSessionStoragePolicy(): Promise<void> {
  const sessionArea = getStorageSession();
  await sessionArea.setAccessLevel?.({
    accessLevel: 'TRUSTED_CONTEXTS',
  });
}

export async function clearSession(): Promise<void> {
  accessTokenMemory = null;
  accessTokenExpiresAtMemory = null;
  userMemory = null;

  await clearRefreshToken();
}

export async function ensureAccessToken(): Promise<string> {
  if (hasUsableAccessToken()) {
    return accessTokenMemory as string;
  }

  return forceRefreshAccessToken();
}

export async function forceRefreshAccessToken(): Promise<string> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    await clearSession();
    throw createBackgroundError('AUTH_REQUIRED', 'A login session is required.');
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    await applyTokens(tokens);
    return tokens.accessToken;
  } catch {
    await clearSession();
    throw createBackgroundError('AUTH_REQUIRED', 'Session expired. Please login again.');
  }
}

export async function loginSession(): Promise<SessionView> {
  const tokens = await loginWithWebAuthFlow();
  await applyTokens(tokens);

  return getAuthenticatedView();
}

export async function logoutSession(): Promise<void> {
  await clearSession();
}

export async function getSessionView(): Promise<SessionView> {
  if (hasUsableAccessToken()) {
    return getAuthenticatedView();
  }

  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    return getLoggedOutView();
  }

  try {
    await forceRefreshAccessToken();
    return getAuthenticatedView();
  } catch {
    return getLoggedOutView();
  }
}
