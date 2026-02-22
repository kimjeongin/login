# A2A + Auth Copy-Paste Guide

대상:  
- Client: WXT/브라우저 확장(또는 프론트 앱)의 A2A 호출부  
- Server: FastAPI + Keycloak 인증 서버

목표: A2A 프로토콜(`tasks/send`, `tasks/get`)을 사용하면서 기존 Keycloak 인증/인가를 그대로 적용

## 1) 권장 버전 조합
- Client: `@a2a-js/sdk >= 0.3.10`
- Server: `a2a-server == 0.6.1`
- Server: `a2a-json-rpc == 0.3.0` (중요: 0.4와 조합 시 런타임 불일치 가능)
- Server: `langchain`, `langchain-ollama`

## 2) Server 이식 (인증 포함)

### 2-1. 복사할 핵심 파일
```text
app/chat/infrastructure/a2a_app_factory.py
app/chat/infrastructure/langchain_chat_handler.py
```

아래 연결 파일도 반영합니다.
```text
app/core/settings.py    # CHAT_* 설정 추가
app/main.py             # app.mount("/api/chat/a2a", create_chat_a2a_app(...))
```

### 2-2. 인증 미들웨어 핵심
`app/chat/infrastructure/a2a_app_factory.py`에서 아래 순서를 유지합니다.
1. `Authorization: Bearer` 토큰 추출
2. `auth_service.authenticate(token)`
3. `auth_service.authorize_user(principal)` (`AUTH_REQUIRED_ROLE`)
4. 실패 시 `401`/`403` JSON 응답 반환

즉, A2A endpoint도 일반 REST endpoint와 같은 인증 정책을 강제합니다.

### 2-3. mount 경로 주의사항 (중요)
`a2a-server`의 handler card URL 계산 시 mount prefix가 빠질 수 있습니다.  
`agent_card.url`을 절대 경로로 명시하세요.

예:
```py
"url": f"{settings.api_prefix}/chat/a2a/{handler_name}"
```

이 설정이 없으면 client가 잘못된 URL로 `tasks/send`를 호출해 `404 Not Found`가 날 수 있습니다.

### 2-4. 서버 환경변수
```env
CHAT_A2A_HANDLER_NAME=chatbot
CHAT_OLLAMA_BASE_URL=http://localhost:11434
CHAT_OLLAMA_MODEL=qwen3:8b
CHAT_OLLAMA_TEMPERATURE=0.2
CHAT_RESPONSE_TIMEOUT_SECONDS=60
CHAT_HISTORY_MAX_MESSAGES=12
```

기존 인증 설정도 동일하게 필요합니다.
```env
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=test
KEYCLOAK_EXPECTED_AUDIENCE=your-api-audience
AUTH_REQUIRED_ROLE=active
API_PREFIX=/api
```

## 3) Client 이식 (인증 포함)

### 3-1. 복사할 핵심 파일
```text
src/entities/chat/model/types.ts
src/domains/chat/messaging/chat.contracts.ts
src/domains/chat/messaging/chat-message.validators.ts
src/domains/chat/messaging/chat-messaging.client.ts
src/domains/chat/background/a2a-chat.client.ts
src/domains/chat/background/handlers/chat-handlers.ts
```

아래 공용 연결 파일도 반영합니다.
```text
src/shared/lib/messaging/contracts.ts
src/shared/lib/messaging/client.ts
src/app/background/message-router.ts
src/shared/config/env.ts
```

UI까지 이식하려면:
```text
src/widgets/chat-panel/ui/ChatPanel.tsx
src/widgets/project-dashboard/ui/ProjectDashboard.tsx
```

### 3-2. 인증 fetch 핵심
`a2a-chat.client.ts`에서 A2A SDK에 넣는 `fetchImpl`은 아래 동작을 반드시 가져야 합니다.
1. `ensureAccessToken()`으로 access token 확보
2. `Authorization: Bearer <token>` 헤더 첨부
3. `401`이면 `forceRefreshAccessToken()` 후 1회 재시도
4. 재시도 실패 시 `AUTH_REQUIRED`
5. `403`은 `FORBIDDEN`으로 변환

### 3-3. JSON-RPC `error: null` 정규화
일부 조합에서 성공 응답이 `{"result": ..., "error": null}`로 올 수 있습니다.  
SDK가 이를 에러로 해석하는 경우가 있으므로, `fetchImpl`에서 `error: null`을 제거해 전달하세요.

### 3-4. 클라이언트 환경변수
```env
WXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
WXT_PUBLIC_CHAT_A2A_HANDLER_NAME=chatbot
WXT_PUBLIC_KEYCLOAK_BASE_URL=http://localhost:8080
WXT_PUBLIC_KEYCLOAK_REALM=test
WXT_PUBLIC_KEYCLOAK_CLIENT_ID=extension-client
```

## 4) 다른 프로젝트에 옮길 때 최소 체크리스트
1. Server mount가 실제로 `/api/chat/a2a/<handler>`인지
2. Agent card의 `url`이 mount prefix 포함 URL인지
3. Client `WXT_PUBLIC_API_BASE_URL`와 Server `API_PREFIX`가 일치하는지
4. A2A 호출에 `Authorization` 헤더가 붙는지
5. 권한 없는 토큰일 때 `403`, 만료 토큰일 때 `401` 후 재로그인으로 흐르는지
6. `tasks/send` -> `tasks/get` 폴링으로 최종 artifact 텍스트를 읽는지

## 5) 빠른 수동 점검
1. 인증 없이 `GET /api/chat/a2a/<handler>/.well-known/agent.json` 호출 시 `401`
2. 인증 후 위 endpoint 호출 시 card JSON 수신
3. 인증 후 `POST /api/chat/a2a/<handler>`로 `tasks/send` 호출 시 task id 수신
4. `tasks/get`에서 `completed` + artifact text 확인
