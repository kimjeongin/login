"use server"

import { signIn, signOut } from "./index"

/**
 * Server action: redirect to Keycloak login page.
 * Pass `redirectTo` to return the user to a specific page after login.
 * signIn() with an OIDC provider always throws a NEXT_REDIRECT — this function never returns normally.
 */
export async function login(redirectTo?: string) {
  await signIn("keycloak", { redirectTo: redirectTo ?? "/" })
}

/**
 * Server action: clear local session and sign out from Keycloak.
 * The `signOut` event in `config.ts` handles Keycloak front-channel logout.
 */
export async function logout(redirectTo?: string) {
  await signOut({ redirectTo: redirectTo ?? "/login" })
}
