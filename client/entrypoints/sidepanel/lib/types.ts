export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

export interface KeycloakTokenClaims {
  sub?: string;
  preferred_username?: string;
  exp?: number;
}

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
