# Login Workspace

Keycloak 로그인 후 브라우저 확장(`client/`)이 API 서버(`server/`)를 호출하는 프로젝트입니다.

## 구성
- `client/`: WXT + React 기반 브라우저 확장 (sidepanel + content widget)
- `server/`: FastAPI 기반 API 서버
- Keycloak: 외부 OIDC 공급자

## 빠른 실행
1. Keycloak 설정
- Realm 생성
- Client ID를 `extension-client`(또는 `.env` 값)로 생성
- Redirect URI에 `https://<EXTENSION_ID>.chromiumapp.org/*` 추가

2. 서버 실행
```bash
cd server
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

3. 클라이언트 실행
```bash
cd client
cp .env.example .env
pnpm install
pnpm dev
```

4. 확장 로드
- Chrome 확장 페이지에서 `client/.output/chrome-mv3` 폴더 로드

## 환경변수 매핑
| 목적 | client | server |
|---|---|---|
| Keycloak Base URL | `WXT_PUBLIC_KEYCLOAK_BASE_URL` | `KEYCLOAK_BASE_URL` |
| Keycloak Realm | `WXT_PUBLIC_KEYCLOAK_REALM` | `KEYCLOAK_REALM` |
| Client ID / Audience | `WXT_PUBLIC_KEYCLOAK_CLIENT_ID` | `KEYCLOAK_EXPECTED_AUDIENCE` |
| API Base URL | `WXT_PUBLIC_API_BASE_URL` | `API_PREFIX` + 서버 호스트 |

`WXT_PUBLIC_KEYCLOAK_CLIENT_ID`와 `KEYCLOAK_EXPECTED_AUDIENCE`는 같은 값을 사용해야 audience 검증이 맞습니다.

## 전체 Flow 요약
1. UI(sidepanel/content)가 `browser.runtime.sendMessage`로 background에 요청합니다.
2. background가 로그인/OAuth/토큰 저장/API 프록시를 담당합니다.
3. background가 `Authorization: Bearer <access_token>`으로 서버 API를 호출합니다.
4. 서버는 Keycloak OIDC/JWKS로 토큰을 검증하고 `active` role을 확인합니다.
5. 서버가 owner(subject) 기준으로 프로젝트 목록/생성을 처리해 응답합니다.

## Login Flow (상세)
### 1) 초기 세션 확인
1. sidepanel이 시작되면 `AuthProvider`가 `AUTH_GET_SESSION` 메시지를 보냅니다.
2. background `getSessionView()`가 아래 순서로 세션을 판별합니다.
- 메모리에 유효한 access token이 있으면 즉시 인증 상태 반환
- 메모리 토큰이 없거나 만료 임박이면 `storage.session`의 refresh token 확인
- refresh token이 있으면 refresh grant로 access token 재발급 시도
- refresh 실패 또는 refresh token 없음이면 로그아웃 상태 반환

### 2) 로그인 시작
1. sidepanel 또는 content widget에서 `AUTH_LOGIN` 메시지를 보냅니다.
2. background router가 발신자를 검증합니다.
- `sender.id === browser.runtime.id` 이어야 함
- `AUTH_LOGIN`은 extension page 또는 content script에서만 허용
3. 검증 통과 시 `loginWithWebAuthFlow()`를 실행합니다.

### 3) Keycloak OAuth (Authorization Code + PKCE)
1. background가 PKCE `verifier/challenge`와 `state`를 생성합니다.
2. `browser.identity.getRedirectURL('keycloak')`로 redirect URI를 구성합니다.
3. Keycloak authorize endpoint로 이동합니다.
- `response_type=code`
- `scope=openid profile`
- `code_challenge_method=S256`
4. `launchWebAuthFlow({ interactive: true })`로 로그인 창을 엽니다.
5. callback 수신 후 아래를 검증합니다.
- `state` 일치
- `error` 파라미터 없음
- `code` 존재

### 4) 토큰 교환 및 저장
1. background가 token endpoint에 `grant_type=authorization_code`로 code 교환 요청을 보냅니다.
2. 성공 시 토큰 저장 정책을 적용합니다.
- access token: background 메모리 전용
- access token 만료시각: JWT `exp` 우선, 없으면 `expires_in`으로 계산
- refresh token: `browser.storage.session`에 저장
3. `storage.session`은 `TRUSTED_CONTEXTS`로 제한합니다.

### 5) 로그인 이후 API 호출
1. UI는 `PROJECT_LIST`, `PROJECT_CREATE` 메시지를 background로 보냅니다.
2. background `requestAuthorizedJson()`이 `ensureAccessToken()`으로 토큰을 확보합니다.
3. 서버에 Bearer 토큰으로 요청합니다.
4. 서버는 토큰 검증 + 권한 검증 후 응답합니다.

### 6) 만료/재발급 처리
1. access token은 만료 60초 전부터 재발급 대상으로 취급합니다.
2. API 호출 결과가 `401`이면 background가 refresh를 강제 수행 후 1회 재시도합니다.
3. refresh 실패 시 세션을 삭제하고 `AUTH_REQUIRED`를 반환합니다.
4. UI는 `AUTH_REQUIRED`를 받으면 로그아웃 상태로 전환하고 다시 로그인 화면을 표시합니다.

### 7) 서버 권한 검증
1. 서버가 Bearer 토큰을 추출합니다.
2. Keycloak OIDC 설정과 JWKS를 조회(캐시 사용)해 서명/issuer/audience를 검증합니다.
3. claims에서 principal(`sub`, `preferred_username`, `roles`, `groups`)을 구성합니다.
4. `active` role이 없으면 `403 Forbidden`을 반환합니다.

### 8) 로그아웃
1. UI가 `AUTH_LOGOUT` 메시지를 보냅니다.
2. background가 메모리 access token과 `storage.session` refresh token을 모두 삭제합니다.

## 예외 처리 요약
| 상황 | 결과 |
|---|---|
| 로그인 창 취소, callback 오류, state 불일치 | `AUTH_FAILED` |
| refresh token 없음/실패 | `AUTH_REQUIRED` |
| 서버 401 | refresh 1회 후 실패 시 `AUTH_REQUIRED` |
| 서버 403 (`active` role 없음) | `FORBIDDEN` |
| 서버 400 (입력 오류) | `VALIDATION` |
| 서버 5xx/네트워크 장애 | `NETWORK` |

## 참고
- 서버 저장소는 현재 `InMemoryProjectRepository`라서 서버 재시작 시 데이터가 초기화됩니다.
- 자세한 구성은 `client/README.md`, `server/README.md`를 확인하세요.
