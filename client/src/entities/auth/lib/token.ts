import type { AuthTokenClaims, AuthUser } from '../model/types';

export function parseAccessTokenClaims(token: string): AuthTokenClaims | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as AuthTokenClaims;
  } catch {
    return null;
  }
}

export function getExpiryFromToken(token: string): number | null {
  const claims = parseAccessTokenClaims(token);
  if (!claims || typeof claims.exp !== 'number') {
    return null;
  }

  return claims.exp * 1000;
}

export function getUserFromToken(token: string): AuthUser | null {
  const claims = parseAccessTokenClaims(token);
  if (!claims || !claims.sub) {
    return null;
  }

  return {
    sub: claims.sub,
    username: claims.preferred_username ?? claims.sub,
  };
}

export function isTokenExpired(token: string, nowMs = Date.now()): boolean {
  const expiresAt = getExpiryFromToken(token);
  if (!expiresAt) {
    return true;
  }

  return nowMs >= expiresAt;
}
