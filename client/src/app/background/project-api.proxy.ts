import type {
  Project,
  ProjectCreatePayload,
  ProjectListResponse,
} from '../../entities/project/model/types';
import { requestApiJson } from './http-client';

export async function listProjects(): Promise<Project[]> {
  const response = await requestApiJson<ProjectListResponse>('/projects', {
    method: 'GET',
  });

  return response.items;
}

export async function createProject(payload: ProjectCreatePayload): Promise<Project> {
  return requestApiJson<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
