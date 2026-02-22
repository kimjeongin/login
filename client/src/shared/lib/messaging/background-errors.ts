import type {
  AppErrorCode,
  AppErrorPayload,
  MessageFailure,
  MessageSuccess,
} from './base-contracts';

export class BackgroundError extends Error {
  code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function createBackgroundError(code: AppErrorCode, message: string): BackgroundError {
  return new BackgroundError(code, message);
}

export function toAppError(
  error: unknown,
  fallback: AppErrorPayload,
): AppErrorPayload {
  if (error instanceof BackgroundError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: fallback.code,
      message: error.message,
    };
  }

  return fallback;
}

export function success<T>(data: T): MessageSuccess<T> {
  return {
    ok: true,
    data,
  };
}

export function failure(code: AppErrorCode, message: string): MessageFailure {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}
