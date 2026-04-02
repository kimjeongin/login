# Keycloak 인증 이식 가이드

Next.js 16 + next-auth v5 기반 Keycloak OIDC 인증을 새 프로젝트에 그대로 옮기는 방법을 설명합니다.

## 전제 조건

| 항목 | 버전 |
|------|------|
| Next.js | 16.x |
| next-auth | 5.0.0-beta.30 이상 |
| Keycloak | Public client, Standard Flow + PKCE 설정 완료 |

---

## 1. 패키지 설치

```bash
pnpm add next-auth@5.0.0-beta.30
```

---

## 2. 파일 복사

아래 파일들을 새 프로젝트에 그대로 복사합니다.

```
src/
  lib/
    auth/
      types.ts      ← Session · JWT 타입 확장
      config.ts     ← NextAuth 설정 (Keycloak provider, callbacks)
      index.ts      ← auth · handlers · signIn · signOut export
      actions.ts    ← Server Actions: login() · logout()
  app/
    api/
      auth/
        [...nextauth]/
          route.ts  ← Route handler (2줄)
  proxy.ts          ← 라우트 보호
```

---

## 3. 각 파일 내용

### `src/lib/auth/types.ts`

Session과 JWT 타입을 확장합니다. Keycloak realm roles와 access token을 포함합니다.

```ts
import type { DefaultSession } from "next-auth"

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
```

---

### `src/lib/auth/config.ts`

NextAuth 설정의 핵심 파일입니다.

- **Public client**: `clientSecret: ""` + `token_endpoint_auth_method: "none"` 조합이 필수입니다. 이 설정이 없으면 `@auth/core`가 기본값(`client_secret_basic`)으로 동작해 Keycloak 토큰 엔드포인트에 `Authorization: Basic` 헤더를 보내고, Public client인 Keycloak은 이를 거부합니다.
- **kc_idp_hint**: Keycloak이 broker로 동작할 때 지정한 IdP로 바로 redirect합니다. 설정하지 않으면 Keycloak 자체 로그인 화면이 표시됩니다.
- **token refresh**: JWT 전략에서 access token 만료 시 자동으로 refresh_token으로 재발급합니다.
- **SSO logout**: `signOut` 이벤트에서 Keycloak end_session_endpoint를 호출해 Keycloak 세션도 함께 종료합니다.

```ts
import Keycloak from "next-auth/providers/keycloak"
import type { NextAuthConfig } from "next-auth"
import type { JWT } from "next-auth/jwt"
import "./types"

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

export const authConfig: NextAuthConfig = {
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: "",
      client: {
        token_endpoint_auth_method: "none",
      },
      issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
      checks: ["pkce", "state"],
      authorization: {
        params: {
          kc_idp_hint: process.env.AUTH_KEYCLOAK_IDP_HINT,
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
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

      if (Date.now() < token.expiresAt * 1000) {
        return token
      }

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
    async signOut(message) {
      if (!("token" in message) || !message.token) return

      const { idToken } = message.token as JWT
      if (!idToken) return

      const issuer = process.env.AUTH_KEYCLOAK_ISSUER!
      const logoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`)
      logoutUrl.searchParams.set("id_token_hint", idToken)

      await fetch(logoutUrl.toString()).catch(() => {})
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
}
```

---

### `src/lib/auth/index.ts`

NextAuth를 초기화하고 필요한 것들을 export합니다.

```ts
import NextAuth from "next-auth"
import { authConfig } from "./config"

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
```

---

### `src/lib/auth/actions.ts`

로그인·로그아웃 Server Actions입니다. Page 컴포넌트의 `<form action={...}>`에서 직접 사용합니다.

```ts
"use server"

import { signIn, signOut } from "./index"

export async function login(redirectTo?: string) {
  await signIn("keycloak", { redirectTo: redirectTo ?? "/" })
}

export async function logout(redirectTo?: string) {
  await signOut({ redirectTo: redirectTo ?? "/login" })
}
```

---

### `src/app/api/auth/[...nextauth]/route.ts`

next-auth의 OAuth callback, session, CSRF 등 내장 엔드포인트를 등록합니다.

```ts
import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
```

---

### `src/proxy.ts`

Next.js 16의 Proxy(구 middleware)로 라우트를 보호합니다.

- `protectedPrefixes`: 인증이 필요한 경로 prefix 목록
- `authOnlyPaths`: 이미 로그인된 사용자를 redirect할 경로 (로그인 페이지 등)
- `RefreshAccessTokenError`: token refresh 실패 시 강제 재로그인

```ts
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const protectedPrefixes = ["/dashboard", "/profile", "/settings"]
const authOnlyPaths = ["/login"]

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isAuthenticated = !!session

  const isProtected = protectedPrefixes.some((prefix) =>
    nextUrl.pathname.startsWith(prefix)
  )
  const isAuthOnly = authOnlyPaths.some((path) =>
    nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", nextUrl.origin)
    loginUrl.searchParams.set("redirectTo", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthOnly && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin))
  }

  if (session?.error === "RefreshAccessTokenError") {
    const loginUrl = new URL("/login", nextUrl.origin)
    loginUrl.searchParams.set("redirectTo", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)" ],
}
```

---

## 4. 환경 변수

프로젝트 루트에 `.env.local`을 생성합니다.

```bash
# Generate with: openssl rand -base64 32
AUTH_SECRET=

# Keycloak — Public client, Standard Flow (Authorization Code + PKCE)
AUTH_KEYCLOAK_ID=
# Format: https://<keycloak-host>/realms/<realm-name>
AUTH_KEYCLOAK_ISSUER=
# Identity Provider alias configured in Keycloak (Identity Providers > Alias)
# Setting this skips Keycloak's login page and redirects directly to the IdP
AUTH_KEYCLOAK_IDP_HINT=
```

`AUTH_SECRET`은 아래 명령으로 생성합니다.

```bash
openssl rand -base64 32
```

---

## 5. Keycloak 클라이언트 설정

Keycloak 관리 콘솔에서 아래와 같이 설정합니다.

| 항목 | 값 |
|------|----|
| Client type | OpenID Connect |
| Client authentication | OFF (Public client) |
| Standard flow | ON |
| Valid redirect URIs | `https://<your-domain>/api/auth/callback/keycloak` |
| Valid post logout redirect URIs | `https://<your-domain>/login` |
| Web origins | `https://<your-domain>` |

PKCE는 Keycloak 18+ 기준으로 Public client에서 기본 활성화되어 있습니다. `Proof Key for Code Exchange Code Challenge Method`가 `S256`으로 설정되어 있는지 확인합니다.

IdP(ADSSO) 연동이 있는 경우, **Identity Providers** 메뉴에서 해당 IdP의 **Alias** 값을 `AUTH_KEYCLOAK_IDP_HINT`에 입력합니다.

---

## 6. 사용 방법

### 서버 컴포넌트에서 세션 읽기

```ts
import { auth } from "@/lib/auth"

export default async function Page() {
  const session = await auth()

  if (!session) return null

  console.log(session.user.id)        // Keycloak sub
  console.log(session.user.roles)     // realm_access.roles
  console.log(session.accessToken)    // Bearer token for upstream APIs
}
```

### 로그인 버튼

```tsx
import { login } from "@/lib/auth/actions"

export default function LoginPage() {
  return (
    <form action={async () => { "use server"; await login() }}>
      <button type="submit">Sign in</button>
    </form>
  )
}
```

### 로그아웃 버튼

```tsx
import { logout } from "@/lib/auth/actions"

export default function Header() {
  return (
    <form action={async () => { "use server"; await logout() }}>
      <button type="submit">Sign out</button>
    </form>
  )
}
```

### 보호된 경로 추가

`src/proxy.ts`의 `protectedPrefixes` 배열에 경로를 추가합니다.

```ts
const protectedPrefixes = ["/dashboard", "/profile", "/settings", "/admin"]
```

### upstream API 호출

```ts
const session = await auth()

const res = await fetch("https://api.example.com/data", {
  headers: {
    Authorization: `Bearer ${session?.accessToken}`,
  },
})
```

---

## 7. 세션 에러 처리

token refresh에 실패하면 `session.error`가 `"RefreshAccessTokenError"`로 설정됩니다. `proxy.ts`가 자동으로 로그인 페이지로 redirect하지만, 클라이언트 컴포넌트에서 직접 처리할 수도 있습니다.

```tsx
"use client"

import { useSession } from "next-auth/react"
import { useEffect } from "react"
import { login } from "@/lib/auth/actions"

export function SessionGuard() {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      login()
    }
  }, [session])

  return null
}
```

---

## 구조 요약

```
로그인 요청
  → proxy.ts (미인증 감지)
  → /login page
  → login() Server Action
  → signIn("keycloak") [next-auth]
  → Keycloak authorization endpoint (?kc_idp_hint=...)
  → ADSSO 로그인 화면
  → Keycloak callback
  → /api/auth/callback/keycloak [next-auth route handler]
  → jwt callback (access_token, refresh_token, roles 저장)
  → session callback (Session 객체에 노출)
  → redirectTo 경로로 이동

로그아웃 요청
  → logout() Server Action
  → signOut() [next-auth]
  → events.signOut (Keycloak end_session_endpoint 호출)
  → 세션 쿠키 삭제
  → /login 으로 redirect
```
