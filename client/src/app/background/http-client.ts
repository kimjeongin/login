import { API_BASE_URL } from '../../shared/config/env';
import { clearSession, ensureAccessToken, forceRefreshAccessToken } from './auth-session.service';
import { createBackgroundError } from './errors';

type JsonObject = Record<string, unknown>;

async function parseJsonResponse(response: Response): Promise<JsonObject> {
  const raw = await response.text();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as JsonObject;
  } catch {
    return {};
  }
}

function createErrorFromStatus(status: number, message: string) {
  if (status === 400) {
    return createBackgroundError('VALIDATION', message);
  }

  if (status === 401) {
    return createBackgroundError('AUTH_REQUIRED', message);
  }

  return createBackgroundError('NETWORK', message);
}

function buildAuthHeaders(init: RequestInit, accessToken: string): Headers {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

async function fetchWithAccessToken(
  path: string,
  init: RequestInit,
  accessToken: string,
): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildAuthHeaders(init, accessToken),
  });
}

export async function requestApiJson<T>(path: string, init: RequestInit): Promise<T> {
  let accessToken: string;
  try {
    accessToken = await ensureAccessToken();
  } catch {
    throw createBackgroundError('AUTH_REQUIRED', 'A login session is required.');
  }

  let response: Response;
  try {
    response = await fetchWithAccessToken(path, init, accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.';
    throw createBackgroundError('NETWORK', message);
  }

  if (response.status === 401) {
    try {
      accessToken = await forceRefreshAccessToken();
      response = await fetchWithAccessToken(path, init, accessToken);
    } catch {
      await clearSession();
      throw createBackgroundError('AUTH_REQUIRED', 'Session expired. Please login again.');
    }
  }

  const body = await parseJsonResponse(response);
  if (!response.ok) {
    const message =
      typeof body.detail === 'string'
        ? body.detail
        : `Request failed with status ${response.status}`;

    if (response.status === 401) {
      await clearSession();
    }

    throw createErrorFromStatus(response.status, message);
  }

  return body as T;
}
