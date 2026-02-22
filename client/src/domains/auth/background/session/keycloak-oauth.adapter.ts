import {
  loginWithWebAuthFlow,
  refreshAccessToken,
} from '../keycloak-oauth.client';
import type { OAuthClient } from './session.types';

export function createKeycloakOAuthClient(): OAuthClient {
  return {
    login: () => loginWithWebAuthFlow(),
    refresh: (refreshToken: string) => refreshAccessToken(refreshToken),
  };
}
