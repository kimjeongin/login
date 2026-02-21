export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthUser {
  sub: string;
  username: string;
}

export interface SessionView {
  isAuthenticated: boolean;
  user: AuthUser | null;
  expiresAt: number | null;
}

export interface AuthTokenClaims {
  sub?: string;
  preferred_username?: string;
  exp?: number;
}
