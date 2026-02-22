# Login Workspace

Keycloak 로그인 후 브라우저 확장(`client/`)이 FastAPI 서버(`server/`)를 호출하는 프로젝트입니다.

## 구성
- `client/`: WXT + React 기반 확장 (sidepanel + content widget)
- `server/`: FastAPI API 서버
- Keycloak: OIDC provider

## 빠른 실행
1. Keycloak 설정
- Realm 생성
- 브라우저 확장용 Public Client 생성
- Redirect URI: `https://<EXTENSION_ID>.chromiumapp.org/*`

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
- Chrome 확장 페이지에서 `client/.output/chrome-mv3` 로드

## 환경변수 매핑
| 목적 | client | server |
|---|---|---|
| Keycloak Base URL | `WXT_PUBLIC_KEYCLOAK_BASE_URL` | `KEYCLOAK_BASE_URL` |
| Keycloak Realm | `WXT_PUBLIC_KEYCLOAK_REALM` | `KEYCLOAK_REALM` |
| OAuth Client ID | `WXT_PUBLIC_KEYCLOAK_CLIENT_ID` | - |
| Access Token Audience 검증값 | - | `KEYCLOAK_EXPECTED_AUDIENCE` |
| 권한 Role | - | `AUTH_REQUIRED_ROLE` |
| API Base URL | `WXT_PUBLIC_API_BASE_URL` | `API_PREFIX` + 서버 호스트 |

`KEYCLOAK_EXPECTED_AUDIENCE`는 토큰의 `aud`와 일치해야 하며, `client_id`와 반드시 같을 필요는 없습니다.

## 인증 Flow 요약
1. UI는 메시지(`browser.runtime.sendMessage`)만 보내고 토큰/HTTP는 직접 다루지 않습니다.
2. background가 Keycloak OAuth(PKCE), 토큰 저장, refresh, API 호출을 담당합니다.
3. 서버는 `Authorization: Bearer <access_token>`을 검증합니다.
4. 서버는 `iss`/`aud`/서명 검증 후 role policy(`AUTH_REQUIRED_ROLE`)를 검사합니다.

## 토큰 사용 원칙
- 서버 인증/인가: **access token만 사용**
- refresh token: background에서 access token 재발급용으로만 사용
- id token: 현재 인증 로직에 사용하지 않음

## 문서
- 클라이언트 상세: `client/README.md`
- 서버 상세: `server/README.md`
- 복사-붙여넣기 이식 가이드(클라이언트): `docs/client-auth-copy-paste.md`
- 복사-붙여넣기 이식 가이드(서버): `docs/server-auth-copy-paste.md`
