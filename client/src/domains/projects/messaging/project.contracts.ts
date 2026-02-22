import type { Project, ProjectCreatePayload } from '../../../entities/project/model/types';

export type ProjectMessage =
  | { type: 'PROJECT_LIST' }
  | { type: 'PROJECT_CREATE'; payload: ProjectCreatePayload };

export interface ProjectMessageResultMap {
  PROJECT_LIST: Project[];
  PROJECT_CREATE: Project;
}
