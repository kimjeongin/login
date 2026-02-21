import type { AuthTokens } from '../../entities/auth/model/types';
import {
  KEYCLOAK_AUTH_URL,
  KEYCLOAK_CLIENT_ID,
  KEYCLOAK_TOKEN_URL,
} from '../../shared/config/env';
import { createBackgroundError } from './errors';

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomBase64Url(bytesLength = 32): string {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomBase64Url(64);
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const challenge = base64UrlEncode(new Uint8Array(digest));

  return { verifier, challenge };
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toTokens(payload: Record<string, unknown>): AuthTokens {
  return {
    accessToken: String(payload.access_token ?? ''),
    refreshToken:
      typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
    tokenType: String(payload.token_type ?? 'Bearer'),
    expiresIn: Number(payload.expires_in ?? 0),
  };
}

async function exchangeToken(form: URLSearchParams): Promise<AuthTokens> {
  let response: Response;
  try {
    response = await fetch(KEYCLOAK_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Keycloak token request failed.';
    throw createBackgroundError('NETWORK', message);
  }

  const body = await parseJson(response);
  if (!response.ok) {
    const message =
      typeof body.error_description === 'string'
        ? body.error_description
        : typeof body.error === 'string'
          ? body.error
          : 'Keycloak authentication failed.';
    throw createBackgroundError('AUTH_FAILED', message);
  }

  const tokens = toTokens(body);
  if (!tokens.accessToken) {
    throw createBackgroundError('AUTH_FAILED', 'Keycloak did not return an access token.');
  }

  return tokens;
}

export async function loginWithWebAuthFlow(): Promise<AuthTokens> {
  const { verifier, challenge } = await createPkcePair();
  const state = randomBase64Url(16);
  const redirectUri = browser.identity.getRedirectURL('keycloak');

  const authUrl = new URL(KEYCLOAK_AUTH_URL);
  authUrl.searchParams.set('client_id', KEYCLOAK_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  let redirectedUrl: string | undefined;
  try {
    redirectedUrl = await browser.identity.launchWebAuthFlow({
      interactive: true,
      url: authUrl.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login flow was cancelled.';
    throw createBackgroundError('AUTH_FAILED', message);
  }

  if (!redirectedUrl) {
    throw createBackgroundError('AUTH_FAILED', 'Login callback URL is missing.');
  }

  const callback = new URL(redirectedUrl);
  const callbackState = callback.searchParams.get('state');
  if (callbackState !== state) {
    throw createBackgroundError('AUTH_FAILED', 'OAuth state validation failed.');
  }

  const error = callback.searchParams.get('error_description') ?? callback.searchParams.get('error');
  if (error) {
    throw createBackgroundError('AUTH_FAILED', error);
  }

  const code = callback.searchParams.get('code');
  if (!code) {
    throw createBackgroundError('AUTH_FAILED', 'Authorization code was not returned.');
  }

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KEYCLOAK_CLIENT_ID,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  return exchangeToken(form);
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: KEYCLOAK_CLIENT_ID,
    refresh_token: refreshToken,
  });

  return exchangeToken(form);
}
