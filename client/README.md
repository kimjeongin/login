# Client

WXT + React 기반 브라우저 확장 클라이언트입니다.  
인증/OAuth/토큰 보관/API 호출은 모두 background service worker가 담당합니다.

## 실행
```bash
cp .env.example .env
pnpm install
pnpm compile
pnpm dev
```

Chrome 확장 페이지에서 `./.output/chrome-mv3`를 로드해 확인합니다.

## 환경변수
```env
WXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
WXT_PUBLIC_KEYCLOAK_BASE_URL=http://localhost:8080
WXT_PUBLIC_KEYCLOAK_REALM=test
WXT_PUBLIC_KEYCLOAK_CLIENT_ID=extension-client
```

## 구성
- `entrypoints/background.ts`: background 시작점
- `src/app/background/*`: background 오케스트레이션(초기화, 메시지 라우터)
- `src/domains/auth/*`: 인증 도메인(OAuth, 세션, 핸들러, 메시지 계약/클라이언트, validator)
- `src/domains/projects/*`: 프로젝트 도메인(API, 핸들러, 메시지 계약/클라이언트, validator)
- `src/shared/api/*`: 공통 API 호출 유틸(`requestAuthorizedJson`)
- `src/shared/lib/messaging/*`: 메시지 공통 타입/런타임/에러 유틸
- `entrypoints/sidepanel/*`: React UI
- `entrypoints/content.ts`: content widget

## 런타임 경계
- sidepanel/content는 토큰을 직접 저장하거나 서버를 직접 호출하지 않습니다.
- sidepanel/content는 `browser.runtime.sendMessage`만 사용합니다.
- background만 Keycloak token endpoint, backend API에 네트워크 요청을 보냅니다.

## 메시지 계약
- `AUTH_GET_SESSION`: 현재 세션 조회
- `AUTH_LOGIN`: Keycloak 로그인 시작
- `AUTH_LOGOUT`: 세션 삭제
- `PROJECT_LIST`: 프로젝트 목록 조회
- `PROJECT_CREATE`: 프로젝트 생성

## Login Flow (상세)
### 1) 앱 시작 시 세션 부트스트랩
1. `AuthProvider`가 마운트되면 `requestAuthSession()`을 호출합니다.
2. `AUTH_GET_SESSION`이 background `getSessionView()`로 전달됩니다.
3. `getSessionView()` 동작
- 메모리에 유효한 access token이 있으면 인증 상태 반환
- 없으면 `storage.session`에서 refresh token 조회
- refresh token이 있으면 `refreshAccessToken()`으로 재발급 시도
- 재발급 실패 시 세션 삭제 후 로그아웃 상태 반환

### 2) 로그인 요청 진입
1. sidepanel(`LoginCard`) 또는 content widget에서 `requestAuthLogin()` 호출
2. message router가 발신자 검증
- `sender.id === browser.runtime.id`
- `AUTH_LOGIN`은 extension page(sender.url) 또는 content script(sender.tab.id)에서만 허용
3. 통과 시 `loginSession()` 실행

### 3) OAuth Authorization Code + PKCE
1. `loginWithWebAuthFlow()`가 PKCE `verifier/challenge` 생성
2. `state` 랜덤값 생성
3. `browser.identity.getRedirectURL('keycloak')`로 redirect URI 생성
4. authorize URL 파라미터 구성
- `client_id`
- `response_type=code`
- `scope=openid profile`
- `state`
- `code_challenge`, `code_challenge_method=S256`
5. `browser.identity.launchWebAuthFlow({ interactive: true })` 호출
6. callback 검증
- `state` 일치 확인
- `error` 파라미터 확인
- `code` 존재 확인

### 4) 토큰 교환/저장
1. token endpoint에 `grant_type=authorization_code` 요청
2. 성공 시 `applyTokens()` 실행
- access token: background 메모리에 저장
- 만료시각: JWT `exp` 우선, 없으면 `expires_in` 기반 계산
- 사용자 정보: access token claims(`sub`, `preferred_username`)에서 추출
- refresh token: `browser.storage.session` 저장
3. background 시작 시 `initializeSessionStoragePolicy()`가 `storage.session` 접근 레벨을 `TRUSTED_CONTEXTS`로 설정

### 5) 로그인 이후 API 호출
1. UI는 `PROJECT_LIST` 또는 `PROJECT_CREATE` 메시지를 전송
2. background `requestAuthorizedJson()`이 `ensureAccessToken()`으로 토큰 확보
3. `Authorization: Bearer <access_token>`으로 서버 호출

### 6) 만료/재발급 로직
1. access token은 만료 60초 전부터 재발급 대상으로 간주
2. API가 `401`을 반환하면 refresh 후 같은 요청 1회 재시도
3. refresh 실패 시 `clearSession()` 후 `AUTH_REQUIRED` 반환
4. UI는 `AUTH_REQUIRED`를 받으면 세션을 갱신해 로그인 화면으로 복귀

### 7) 로그아웃
1. `AUTH_LOGOUT` 메시지 전송
2. background가 access token 메모리/refresh token 저장소를 모두 삭제
3. UI가 로그아웃 상태로 전환

## 토큰 사용 원칙
- 서버 호출 인증: access token만 사용
- refresh token: background에서 재발급용으로만 사용
- id token: 현재 인증 로직에서 사용하지 않음

## 에러 코드
- `AUTH_REQUIRED`: 로그인 필요, refresh 실패
- `AUTH_FAILED`: Keycloak 인증 실패/취소/state 검증 실패
- `FORBIDDEN`: 서버 권한 부족(예: `active` role 없음)
- `VALIDATION`: 입력값 오류
- `NETWORK`: 네트워크 실패 또는 서버 5xx
- `FORBIDDEN_CONTEXT`: 허용되지 않은 실행 컨텍스트에서 요청

## 참고
- `wxt.config.ts`의 `manifest.key`가 고정되어 extension id가 안정적으로 유지됩니다.
- Keycloak Redirect URI는 `https://<EXTENSION_ID>.chromiumapp.org/*`로 설정해야 합니다.
- 이식 가이드는 `../docs/client-auth-copy-paste.md`를 참고하세요.
