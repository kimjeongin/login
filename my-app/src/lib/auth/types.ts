import type { DefaultSession } from "next-auth"

/**
 * Keycloak realm roles extracted from the access token.
 * Extend this to match your Keycloak realm's role names.
 */
export type KeycloakRole = string

export interface KeycloakTokenSet {
  accessToken: string
  refreshToken: string
  idToken: string
  /** Unix timestamp (seconds) when the access token expires */
  expiresAt: number
  /** Set when token refresh fails */
  error?: "RefreshAccessTokenError"
}

// Augment next-auth module types
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string
      roles: KeycloakRole[]
    } & DefaultSession["user"]
    /** Raw Keycloak access token — forward this to upstream APIs */
    accessToken: string
    /** Non-null when the refresh failed; client should force re-login */
    error?: "RefreshAccessTokenError"
  }
}

declare module "next-auth/jwt" {
  interface JWT extends KeycloakTokenSet {
    roles: KeycloakRole[]
  }
}
