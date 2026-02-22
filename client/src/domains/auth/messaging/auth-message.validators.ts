import type { MessageValidators } from '../../../shared/lib/messaging/router.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasType(
  value: unknown,
  type: 'AUTH_LOGIN' | 'AUTH_LOGOUT' | 'AUTH_GET_SESSION',
): boolean {
  return isObject(value) && value.type === type;
}

export function createAuthMessageValidators(): MessageValidators {
  return {
    AUTH_LOGIN: (value) => hasType(value, 'AUTH_LOGIN'),
    AUTH_LOGOUT: (value) => hasType(value, 'AUTH_LOGOUT'),
    AUTH_GET_SESSION: (value) => hasType(value, 'AUTH_GET_SESSION'),
  };
}
