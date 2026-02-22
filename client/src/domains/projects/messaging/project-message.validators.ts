import type { ProjectCreatePayload } from '../../../entities/project/model/types';
import type { MessageValidators } from '../../../shared/lib/messaging/router.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasType(value: unknown, type: 'PROJECT_LIST' | 'PROJECT_CREATE'): boolean {
  return isObject(value) && value.type === type;
}

function isProjectCreatePayload(value: unknown): value is ProjectCreatePayload {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.name !== 'string') {
    return false;
  }

  if (
    typeof value.description !== 'undefined' &&
    typeof value.description !== 'string'
  ) {
    return false;
  }

  return true;
}

export function createProjectMessageValidators(): MessageValidators {
  return {
    PROJECT_LIST: (value) => hasType(value, 'PROJECT_LIST'),
    PROJECT_CREATE: (value) => {
      if (!hasType(value, 'PROJECT_CREATE')) {
        return false;
      }

      return isProjectCreatePayload(
        (value as { payload?: unknown }).payload,
      );
    },
  };
}
