import type { ProjectCreatePayload } from '../../../entities/project/model/types';
import { sendMessage } from '../../../shared/lib/messaging/runtime.client';

export function requestProjectList() {
  return sendMessage({ type: 'PROJECT_LIST' });
}

export function requestProjectCreate(payload: ProjectCreatePayload) {
  return sendMessage({ type: 'PROJECT_CREATE', payload });
}
