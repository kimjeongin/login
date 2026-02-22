# SSE + Auth Copy-Paste Guide

대상:  
- Client: 브라우저 확장/웹 앱에서 `EventSource`로 SSE를 수신하는 프로젝트  
- Server: FastAPI + Keycloak 인증 서버

목표: SSE 연결과 action POST 요청 모두에 인증을 적용하고, 사용자별 이벤트를 실시간으로 표시

## 1) 왜 `EventSourcePolyfill`을 사용했는가
- 네이티브 `EventSource`는 생성자 옵션이 제한적이라 `Authorization` 헤더를 직접 넣을 수 없습니다.
- 따라서 bearer token 기반 인증이 필요하면 `event-source-polyfill` 같은 폴리필이 실용적입니다.

참고:
- MDN EventSource constructor: https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource
- event-source-polyfill(custom headers): https://github.com/Yaffle/EventSource

## 2) 권장 패키지
- Client: `event-source-polyfill==1.0.31`
- Server: 기존 Keycloak 인증 스택(`fastapi`, `python-jose`, `httpx`, `pydantic-settings`)

## 3) Server 이식

### 3-1. 복사할 파일
```text
app/browser_control/services/browser_control_event_service.py
app/browser_control/presentation/schemas.py
app/browser_control/presentation/router.py
```

연결 파일:
```text
app/core/dependencies.py
app/api/router.py
```

### 3-2. 핵심 동작
1. `GET /api/browser-control/events`
   - `get_current_authorized_principal` dependency로 인증
   - 사용자 subject 기준 queue subscribe
   - `text/event-stream`으로 `control-action` 이벤트 전송
2. `POST /api/browser-control/actions`
   - 인증된 사용자만 action(`click|popup|close`) publish 가능
   - 같은 사용자 subject 구독자에게 이벤트 fan-out

### 3-3. 최소 체크
1. 미인증 요청 시 `401`
2. 권한 불충분 시 `403`
3. 인증된 상태에서 action POST 후 SSE 이벤트 수신

## 4) Client 이식

### 4-1. 복사할 파일
```text
src/entities/browser-control/model/types.ts
src/domains/browser-control/messaging/browser-control.contracts.ts
src/domains/browser-control/messaging/browser-control-message.validators.ts
src/domains/browser-control/messaging/browser-control-messaging.client.ts
src/domains/browser-control/background/browser-control-api.client.ts
src/domains/browser-control/background/handlers/browser-control-handlers.ts
src/widgets/browser-control-panel/ui/BrowserControlPanel.tsx
src/types/event-source-polyfill.d.ts
```

연결 파일:
```text
src/shared/lib/messaging/contracts.ts
src/shared/lib/messaging/client.ts
src/app/background/message-router.ts
```

### 4-2. 인증 흐름
1. UI가 `BROWSER_CONTROL_GET_SSE_TOKEN` 요청
2. background가 `ensureAccessToken()`으로 token 반환
3. UI가 `EventSourcePolyfill(url, { headers: { Authorization: `Bearer ...` } })`로 SSE 연결
4. action 버튼 클릭 시 `BROWSER_CONTROL_SEND_ACTION` 메시지
5. background가 인증된 POST(`/api/browser-control/actions`) 호출
6. UI가 SSE 이벤트를 받아 로그 렌더링

## 5) 다른 프로젝트로 옮길 때 주의점
1. SSE endpoint와 action endpoint 모두 인증 dependency를 강제할 것
2. 이벤트 버스는 사용자 단위(subject 단위)로 분리할 것
3. 브라우저 환경에서 header 기반 SSE가 필요하면 네이티브 EventSource 대신 폴리필 사용할 것
4. 토큰 만료 시 재연결 UX(재시작 버튼/자동 재연결 정책)를 명확히 둘 것
