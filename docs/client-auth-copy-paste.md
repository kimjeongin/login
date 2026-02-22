# Client Auth Copy-Paste Guide

대상: WXT 기반 브라우저 확장 프로젝트

## 1) 복사할 파일
아래 경로를 그대로 복사합니다.

```text
src/domains/auth/
src/shared/api/authorized-api.client.ts
src/shared/config/env.ts
src/shared/lib/messaging/base-contracts.ts
src/shared/lib/messaging/background-errors.ts
src/shared/lib/messaging/runtime.client.ts
src/shared/lib/messaging/router.types.ts
src/shared/lib/messaging/contracts.ts
src/shared/lib/messaging/client.ts
src/app/background/initBackground.ts
src/app/background/message-router.ts
entrypoints/background.ts
```

현재 프로젝트에서 `projects` 도메인까지 함께 쓸 경우 아래도 같이 복사합니다.

```text
src/domains/projects/
```

현재 프로젝트처럼 A2A 채팅까지 함께 쓸 경우 아래도 같이 복사합니다.

```text
src/entities/chat/
src/domains/chat/
src/widgets/chat-panel/
```

## 2) 환경변수 추가
`client/.env`에 아래 키를 맞춥니다.

```env
WXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
WXT_PUBLIC_KEYCLOAK_BASE_URL=http://localhost:8080
WXT_PUBLIC_KEYCLOAK_REALM=test
WXT_PUBLIC_KEYCLOAK_CLIENT_ID=extension-client
WXT_PUBLIC_CHAT_A2A_HANDLER_NAME=chatbot
```

## 3) 권한/호스트 설정
`wxt.config.ts`에서 아래를 확인합니다.

- `permissions`: `identity`, `storage`
- `host_permissions`: API 서버와 Keycloak 주소

## 4) 메시지 라우터 연결
`src/app/background/message-router.ts`에서 도메인 등록을 유지합니다.

- handlers 등록: `createAuthHandlers()`, 필요시 `createProjectHandlers()`, `createChatHandlers()`
- validator 등록: `createAuthMessageValidators()`, 필요시 `createProjectMessageValidators()`, `createChatMessageValidators()`

도메인을 추가할 때는 handlers/validators를 같은 방식으로 merge하면 됩니다.

## 5) UI 호출 규칙
UI에서는 아래 함수만 사용합니다.

- `requestAuthSession()`
- `requestAuthLogin()`
- `requestAuthLogout()`
- (채팅 추가 시) `requestChatSend()`

import 경로:

```ts
import {
  requestAuthLogin,
  requestAuthLogout,
  requestAuthSession,
} from '@/src/shared/lib/messaging/client';
```

## 6) 토큰 정책
- 서버 인증에는 access token만 사용합니다.
- refresh token은 background에서 access token 재발급에만 사용합니다.
- id token은 현재 흐름에서 사용하지 않습니다.

## 7) 점검 체크리스트
1. 로그인 후 `/api/*` 호출에 `Authorization: Bearer <access_token>`이 포함되는지
2. access token 만료 시 자동 refresh 후 재시도되는지
3. refresh 실패 시 `AUTH_REQUIRED`로 로그인 화면으로 복귀하는지
4. (채팅 추가 시) `CHAT_SEND` 요청이 background에서만 A2A HTTP 호출을 수행하는지

## 8) A2A 채팅 인증 이식
A2A 채팅까지 다른 프로젝트로 옮길 때는 아래 문서를 함께 참고합니다.

- `a2a-auth-copy-paste.md`
