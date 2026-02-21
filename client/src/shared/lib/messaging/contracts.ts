import type { SessionView } from '../../../entities/auth/model/types';
import type { Project, ProjectCreatePayload } from '../../../entities/project/model/types';

export type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_FAILED'
  | 'NETWORK'
  | 'VALIDATION'
  | 'FORBIDDEN_CONTEXT';

export interface AppErrorPayload {
  code: AppErrorCode;
  message: string;
}

export type MessageSuccess<T> = {
  ok: true;
  data: T;
};

export type MessageFailure = {
  ok: false;
  error: AppErrorPayload;
};

export type MessageResponse<T> = MessageSuccess<T> | MessageFailure;

export type ExtensionMessage =
  | { type: 'AUTH_LOGIN' }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_GET_SESSION' }
  | { type: 'PROJECT_LIST' }
  | { type: 'PROJECT_CREATE'; payload: ProjectCreatePayload };

export interface MessageResultMap {
  AUTH_LOGIN: SessionView;
  AUTH_LOGOUT: { ok: true };
  AUTH_GET_SESSION: SessionView;
  PROJECT_LIST: Project[];
  PROJECT_CREATE: Project;
}

export type MessageByType<T extends keyof MessageResultMap> = Extract<
  ExtensionMessage,
  { type: T }
>;
