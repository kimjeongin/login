/**
 * Auth module — portable Keycloak + NextAuth v5 integration.
 *
 * Copy-paste the entire `src/lib/auth/` directory into any Next.js 16+ project.
 * Required env vars:
 *   AUTH_SECRET              — random secret (openssl rand -base64 32)
 *   AUTH_KEYCLOAK_ID         — Keycloak client ID (public client, no secret)
 *   AUTH_KEYCLOAK_ISSUER     — https://<host>/realms/<realm>
 *   AUTH_KEYCLOAK_IDP_HINT   — IdP alias in Keycloak to skip its login page (optional)
 */
import NextAuth from "next-auth"
import { authConfig } from "./config"

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
