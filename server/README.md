# Server

FastAPI 기반 API 서버입니다.  
Keycloak access token을 검증하고 `active` role 권한을 확인한 뒤 프로젝트 API와 A2A 챗봇 API를 제공합니다.

## 실행
```bash
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

## 환경변수
```env
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=test
KEYCLOAK_EXPECTED_AUDIENCE=extension-client
KEYCLOAK_VERIFY_SSL=false
KEYCLOAK_JWKS_CACHE_TTL_SECONDS=300
AUTH_REQUIRED_ROLE=active
CORS_ALLOW_ORIGINS=*
API_PREFIX=/api
CHAT_A2A_HANDLER_NAME=chatbot
CHAT_OLLAMA_BASE_URL=http://localhost:11434
CHAT_OLLAMA_MODEL=qwen3:8b
CHAT_OLLAMA_TEMPERATURE=0.2
CHAT_RESPONSE_TIMEOUT_SECONDS=60
CHAT_HISTORY_MAX_MESSAGES=12
```

- `KEYCLOAK_EXPECTED_AUDIENCE`가 비어 있으면 audience 검증을 비활성화합니다.
- `KEYCLOAK_JWKS_CACHE_TTL_SECONDS` 기본값은 300초이며 최소 30초입니다.
- `AUTH_REQUIRED_ROLE`은 기존 `EXTENSION_REQUIRED_ROLE` 이름도 호환됩니다.

## API
- `GET /health`
- `GET /api/projects` (인증 + `active` role 필요)
- `POST /api/projects` (인증 + `active` role 필요)
- `GET /api/chat/a2a/<handler>/.well-known/agent.json` (인증 + `active` role 필요)
- `POST /api/chat/a2a/<handler>` (`tasks/send`, `tasks/get` 등 A2A RPC, 인증 + `active` role 필요)

## 모듈 구조
```text
app/
  main.py
  api/router.py
  core/
    settings.py
    dependencies.py
  auth/
    domain/
      principal.py
      access_policy.py
      exceptions.py
    infrastructure/keycloak_token_verifier.py
    services/auth_service.py
    presentation/
      dependencies.py
      http_errors.py
  chat/
    infrastructure/
      a2a_app_factory.py
      langchain_chat_handler.py
  projects/
    domain/
      models.py
      repositories.py
    infrastructure/in_memory_project_repository.py
    services/project_service.py
    presentation/
      schemas.py
      router.py
```

## Login/Auth Flow (서버 측 상세)
### 1) 요청 진입
1. 클라이언트가 `Authorization: Bearer <access_token>`으로 `/api/projects` 요청
2. `HTTPBearer(auto_error=False)`가 헤더에서 bearer credentials를 읽음
3. 헤더가 없거나 scheme이 `Bearer`가 아니면 `401`

### 2) 토큰 검증 (`KeycloakTokenVerifier`)
1. JWT header에서 `kid`를 읽음
2. OIDC 설정(`/.well-known/openid-configuration`)을 조회해 `jwks_uri` 확보
3. JWKS를 조회하고 캐시(TTL) 사용
4. `jwt.decode` 검증 조건
- 알고리즘: `RS256`
- issuer: `KEYCLOAK_BASE_URL/realms/KEYCLOAK_REALM`
- audience: `KEYCLOAK_EXPECTED_AUDIENCE` (값이 있을 때만)
5. 실패 시 JWKS를 강제 갱신해 1회 재시도 (Key rotation 대응)
6. 최종 실패 시 `401`

### 3) Principal 구성
1. `sub` 클레임이 없으면 `401`
2. `preferred_username`를 사용자명으로 사용
3. roles 추출 규칙
- `azp`가 있으면 `resource_access[azp].roles` 우선 사용
- 없으면 `resource_access`의 모든 client role 병합
4. groups는 `groups` 클레임에서 문자열만 수집

### 4) 권한 검증
1. `RoleAccessPolicy(required_role=AUTH_REQUIRED_ROLE)` 적용
2. principal에 설정된 role이 없으면 `403`

### 5) 비즈니스 처리
1. `current_principal.subject`를 owner로 사용
2. `ProjectService`가 목록 조회/생성 수행
3. 저장소는 `InMemoryProjectRepository` 사용

### 6) 응답/오류 변환
- `UnauthorizedError` -> `401`
- `ForbiddenError` -> `403`
- `IdentityProviderUnavailableError` -> `503`
- 프로젝트 생성 시 `ValueError` -> `400`

## 프로젝트 API 동작
### GET `/api/projects`
- owner(subject) 기준 목록 반환
- 응답: `{ "items": [ProjectResponse, ...] }`

### POST `/api/projects`
- 요청: `name(필수, 1~120)`, `description(선택, 최대 500)`
- description이 빈 문자열이면 `null`로 정규화
- owner(subject) 기준으로 프로젝트 생성 후 반환

## 현재 제약
- 저장소가 메모리 기반이라 서버 재시작 시 데이터가 사라집니다.
- 권한 정책이 `active` role 하나로 고정되어 있습니다.

## 참고
- 서버 인증/인가는 access token만 사용합니다.
- 이식 가이드는 `../docs/server-auth-copy-paste.md`를 참고하세요.
