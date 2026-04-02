import Keycloak from "next-auth/providers/keycloak"
import type { NextAuthConfig } from "next-auth"
import type { JWT } from "next-auth/jwt"
import "./types"

// ---------------------------------------------------------------------------
// Token refresh
// Public client (Standard Flow + PKCE) — no client_secret required
// ---------------------------------------------------------------------------

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const issuer = process.env.AUTH_KEYCLOAK_ISSUER!
    const url = `${issuer}/protocol/openid-connect/token`

    const params: Record<string, string> = {
      grant_type: "refresh_token",
      client_id: process.env.AUTH_KEYCLOAK_ID!,
      refresh_token: token.refreshToken,
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    })

    const refreshed = await response.json()

    if (!response.ok) throw refreshed

    return {
      ...token,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      idToken: refreshed.id_token ?? token.idToken,
      expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      error: undefined,
    }
  } catch {
    return { ...token, error: "RefreshAccessTokenError" }
  }
}

// ---------------------------------------------------------------------------
// Roles helper — Keycloak embeds realm roles in the access token
// ---------------------------------------------------------------------------

function extractRoles(accessToken: string): string[] {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1], "base64url").toString()
    )
    return (payload?.realm_access?.roles as string[]) ?? []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// NextAuth configuration
// Keycloak: Standard Flow (Authorization Code + PKCE), Public client
// ---------------------------------------------------------------------------

export const authConfig: NextAuthConfig = {
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      // Public client — no secret. Must also set token_endpoint_auth_method: "none"
      // so @auth/core skips Basic auth header on the token endpoint request.
      // Without this, @auth/core defaults to client_secret_basic and sends
      // Authorization: Basic base64(clientId:) which Keycloak rejects.
      clientSecret: "",
      client: {
        token_endpoint_auth_method: "none",
      },
      issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
      checks: ["pkce", "state"],
      authorization: {
        params: {
          // Bypass Keycloak's login page and go directly to the ADSSO IdP.
          // Set AUTH_KEYCLOAK_IDP_HINT to the IdP alias configured in Keycloak.
          kc_idp_hint: process.env.AUTH_KEYCLOAK_IDP_HINT,
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: persist tokens from Keycloak
      if (account) {
        return {
          ...token,
          accessToken: account.access_token!,
          refreshToken: account.refresh_token!,
          idToken: account.id_token!,
          expiresAt: account.expires_at!,
          roles: extractRoles(account.access_token!),
        }
      }

      // Access token still valid
      if (Date.now() < token.expiresAt * 1000) {
        return token
      }

      // Access token expired — try to refresh
      return refreshAccessToken(token)
    },

    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken,
        error: token.error,
        user: {
          ...session.user,
          id: token.sub!,
          roles: token.roles ?? [],
        },
      }
    },
  },

  events: {
    /**
     * Sign the user out of Keycloak's session as well.
     * next-auth calls this after clearing the local session cookie.
     */
    async signOut(message) {
      if (!("token" in message) || !message.token) return

      const { idToken } = message.token as JWT
      if (!idToken) return

      const issuer = process.env.AUTH_KEYCLOAK_ISSUER!
      const logoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`)
      logoutUrl.searchParams.set("id_token_hint", idToken)

      await fetch(logoutUrl.toString()).catch(() => {
        // Non-fatal: local session is already cleared
      })
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
}
