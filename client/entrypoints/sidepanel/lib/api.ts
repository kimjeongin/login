import type {
  AuthTokens,
  KeycloakTokenClaims,
  Project,
  ProjectCreatePayload,
  ProjectListResponse,
} from './types';

const env = import.meta.env as Record<string, string | undefined>;

const keycloakBaseUrl = env.WXT_PUBLIC_KEYCLOAK_BASE_URL ?? 'http://localhost:8080';
const keycloakRealm = env.WXT_PUBLIC_KEYCLOAK_REALM ?? 'test';
const keycloakClientId = env.WXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'extension-client';

export const API_BASE_URL = env.WXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';
export const KEYCLOAK_ISSUER = `${keycloakBaseUrl.replace(/\/$/, '')}/realms/${keycloakRealm}`;
export const KEYCLOAK_AUTH_URL = `${KEYCLOAK_ISSUER}/protocol/openid-connect/auth`;
export const KEYCLOAK_TOKEN_URL = `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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

function toTokenResponse(payload: Record<string, unknown>): AuthTokens {
  return {
    access_token: String(payload.access_token ?? ''),
    refresh_token:
      typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
    token_type: String(payload.token_type ?? 'Bearer'),
    expires_in: Number(payload.expires_in ?? 0),
  };
}

async function request<T>(
  path: string,
  init: RequestInit,
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const body = await parseJson(response);
  if (!response.ok) {
    const message =
      typeof body.detail === 'string'
        ? body.detail
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return body as T;
}

export async function loginWithWebAuthFlow(): Promise<AuthTokens> {
  const { verifier, challenge } = await createPkcePair();
  const state = randomBase64Url(16);
  const redirectUri = browser.identity.getRedirectURL('keycloak');

  const authUrl = new URL(KEYCLOAK_AUTH_URL);
  authUrl.searchParams.set('client_id', keycloakClientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const redirectedUrl = await browser.identity.launchWebAuthFlow({
    interactive: true,
    url: authUrl.toString(),
  });

  if (!redirectedUrl) {
    throw new ApiError('로그인 콜백 URL을 받지 못했습니다.', 500);
  }

  const callback = new URL(redirectedUrl);
  const callbackState = callback.searchParams.get('state');
  if (callbackState !== state) {
    throw new ApiError('인증 상태(state) 검증에 실패했습니다.', 400);
  }

  const error = callback.searchParams.get('error_description') ?? callback.searchParams.get('error');
  if (error) {
    throw new ApiError(error, 401);
  }

  const code = callback.searchParams.get('code');
  if (!code) {
    throw new ApiError('인가 코드(code)를 받지 못했습니다.', 400);
  }

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: keycloakClientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const tokenResponse = await fetch(KEYCLOAK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const tokenBody = await parseJson(tokenResponse);
  if (!tokenResponse.ok) {
    const message =
      typeof tokenBody.error_description === 'string'
        ? tokenBody.error_description
        : typeof tokenBody.error === 'string'
          ? tokenBody.error
          : 'Keycloak token exchange failed.';
    throw new ApiError(message, tokenResponse.status);
  }

  const tokens = toTokenResponse(tokenBody);
  if (!tokens.access_token) {
    throw new ApiError('Keycloak에서 access token을 받지 못했습니다.', 500);
  }

  return tokens;
}

export function parseAccessTokenClaims(token: string): KeycloakTokenClaims | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as KeycloakTokenClaims;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(token: string): boolean {
  const claims = parseAccessTokenClaims(token);
  if (!claims || typeof claims.exp !== 'number') {
    return false;
  }

  return Date.now() >= claims.exp * 1000;
}

export async function getProjects(accessToken: string): Promise<Project[]> {
  const response = await request<ProjectListResponse>(
    '/projects',
    {
      method: 'GET',
    },
    accessToken,
  );

  return response.items;
}

export async function createProject(
  accessToken: string,
  payload: ProjectCreatePayload,
): Promise<Project> {
  return request<Project>(
    '/projects',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}
