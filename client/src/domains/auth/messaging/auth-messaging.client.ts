import { sendMessage } from '../../../shared/lib/messaging/runtime.client';

export function requestAuthLogin() {
  return sendMessage({ type: 'AUTH_LOGIN' });
}

export function requestAuthLogout() {
  return sendMessage({ type: 'AUTH_LOGOUT' });
}

export function requestAuthSession() {
  return sendMessage({ type: 'AUTH_GET_SESSION' });
}
