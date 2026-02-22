import { API_BASE_URL } from '../config/env';
import {
  ensureAccessToken,
  forceRefreshAccessToken,
} from '../../domains/auth/background/auth-session.service';
import { createBackgroundError } from '../lib/messaging/background-errors';

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

function mapStatusToError(status: number, message: string) {
  if (status === 400) {
    return createBackgroundError('VALIDATION', message);
  }

  if (status === 401) {
    return createBackgroundError('AUTH_REQUIRED', message);
  }

  if (status === 403) {
    return createBackgroundError('FORBIDDEN', message);
  }

  return createBackgroundError('NETWORK', message);
}

function buildAuthorizedHeaders(requestInit: RequestInit, accessToken: string): Headers {
  const headers = new Headers(requestInit.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (requestInit.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

async function fetchAuthorized(
  path: string,
  requestInit: RequestInit,
  accessToken: string,
): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers: buildAuthorizedHeaders(requestInit, accessToken),
  });
}

export async function requestAuthorizedJson<T>(
  path: string,
  requestInit: RequestInit,
): Promise<T> {
  let accessToken: string;
  try {
    accessToken = await ensureAccessToken();
  } catch {
    throw createBackgroundError('AUTH_REQUIRED', 'A login session is required.');
  }

  let response: Response;
  try {
    response = await fetchAuthorized(path, requestInit, accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.';
    throw createBackgroundError('NETWORK', message);
  }

  if (response.status === 401) {
    try {
      accessToken = await forceRefreshAccessToken();
      response = await fetchAuthorized(path, requestInit, accessToken);
    } catch {
      throw createBackgroundError('AUTH_REQUIRED', 'Session expired. Please login again.');
    }
  }

  const body = await parseJsonResponse(response);
  if (!response.ok) {
    const message =
      typeof body.detail === 'string'
        ? body.detail
        : `Request failed with status ${response.status}`;

    throw mapStatusToError(response.status, message);
  }

  return body as T;
}
