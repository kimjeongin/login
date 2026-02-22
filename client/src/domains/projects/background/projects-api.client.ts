import type {
  Project,
  ProjectCreatePayload,
  ProjectListResponse,
} from '../../../entities/project/model/types';
import { requestAuthorizedJson } from '../../../shared/api/authorized-api.client';

export async function fetchProjects(): Promise<Project[]> {
  const response = await requestAuthorizedJson<ProjectListResponse>('/projects', {
    method: 'GET',
  });

  return response.items;
}

export async function createProject(payload: ProjectCreatePayload): Promise<Project> {
  return requestAuthorizedJson<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
