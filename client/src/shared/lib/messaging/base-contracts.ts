export type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_FAILED'
  | 'FORBIDDEN'
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
