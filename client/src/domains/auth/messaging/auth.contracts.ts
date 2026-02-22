import type { SessionView } from '../../../entities/auth/model/types';

export type AuthMessage =
  | { type: 'AUTH_LOGIN' }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_GET_SESSION' };

export interface AuthMessageResultMap {
  AUTH_LOGIN: SessionView;
  AUTH_LOGOUT: { ok: true };
  AUTH_GET_SESSION: SessionView;
}
