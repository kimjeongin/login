export interface Project {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface ProjectListResponse {
  items: Project[];
}

export interface ProjectCreatePayload {
  name: string;
  description?: string;
}
