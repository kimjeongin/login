import { getExpiryFromToken, getUserFromToken } from '../../../entities/auth/lib/token';
import { createAuthSessionService } from './session/create-auth-session.service';
import { createBrowserRefreshTokenStore } from './session/browser-refresh-token.store';
import { createKeycloakOAuthClient } from './session/keycloak-oauth.adapter';

const authSessionService = createAuthSessionService({
  oauthClient: createKeycloakOAuthClient(),
  refreshTokenStore: createBrowserRefreshTokenStore(),
  getExpiryFromToken,
  getUserFromToken,
});

export function initializeSessionStoragePolicy(): Promise<void> {
  return authSessionService.initializeSessionStoragePolicy();
}

export function clearSession(): Promise<void> {
  return authSessionService.clearSession();
}

export function ensureAccessToken(): Promise<string> {
  return authSessionService.ensureAccessToken();
}

export function forceRefreshAccessToken(): Promise<string> {
  return authSessionService.forceRefreshAccessToken();
}

export function loginSession() {
  return authSessionService.loginSession();
}

export function logoutSession(): Promise<void> {
  return authSessionService.logoutSession();
}

export function getSessionView() {
  return authSessionService.getSessionView();
}
