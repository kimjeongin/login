import type { ProjectCreatePayload } from '../../../../entities/project/model/types';
import type { ExtensionMessage } from '../../../../shared/lib/messaging/contracts';
import {
  createBackgroundError,
  success,
} from '../../../../shared/lib/messaging/background-errors';
import { createProject, fetchProjects } from '../projects-api.client';
import type { RouterHandlers } from '../../../../shared/lib/messaging/router.types';

export function createProjectHandlers(): RouterHandlers {
  return {
    PROJECT_LIST: async () => {
      return success(await fetchProjects());
    },
    PROJECT_CREATE: async (message) => {
      const createMessage = message as Extract<
        ExtensionMessage,
        { type: 'PROJECT_CREATE' }
      >;

      const name = createMessage.payload.name.trim();
      if (!name) {
        throw createBackgroundError('VALIDATION', 'Project name is required.');
      }

      const payload: ProjectCreatePayload = {
        name,
        description: createMessage.payload.description?.trim(),
      };

      return success(await createProject(payload));
    },
  };
}
