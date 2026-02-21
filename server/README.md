# Server (FastAPI + Keycloak JWKS Validation)

브라우저 익스텐션용 프로젝트 API 서버입니다.

## API
- `GET /health`
- `GET /api/projects` (인증 + 권한 필요)
- `POST /api/projects` (인증 + 권한 필요)

## 아키텍처
도메인 기준으로 모듈을 분리했습니다.

```text
app/
  api/
    router.py                       # API 라우터 조합
  core/
    settings.py                     # 환경설정 모델
    dependencies.py                 # DI provider(lru_cache 싱글톤)
  auth/
    domain/
      principal.py                  # 인증된 사용자 모델
      access_policy.py              # active role 기반 접근 정책
      exceptions.py                 # 도메인 예외
    infrastructure/
      keycloak_token_verifier.py    # OIDC/JWKS 조회 + JWT 검증
    services/
      auth_service.py               # 인증/인가 유즈케이스
    presentation/
      dependencies.py               # FastAPI Depends(Security) 어댑터
  projects/
    domain/
      models.py                     # Project 엔티티
      repositories.py               # 저장소 인터페이스(Protocol)
    infrastructure/
      in_memory_project_repository.py
    services/
      project_service.py            # 프로젝트 유즈케이스
    presentation/
      schemas.py                    # 요청/응답 스키마
      router.py                     # /projects 엔드포인트
  main.py                           # 앱 팩토리 및 미들웨어
```

## 인증/권한 흐름
1. 클라이언트가 Keycloak에서 access token을 직접 발급
2. 서버는 `Authorization: Bearer <token>`을 수신
3. `KeycloakTokenVerifier`가 OIDC config/JWKS를 가져와 서명/issuer 검증
4. `AuthenticatedPrincipal`로 claims를 정규화 (groups/roles/active)
5. `ExtensionAccessPolicy`가 접근 정책 검증

`/api/projects` 접근 조건:
- `active` role이 있어야 함

## 환경변수
`.env.example`를 기반으로 `.env` 파일을 준비하세요.

```bash
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=test
KEYCLOAK_EXPECTED_AUDIENCE=extension-client
KEYCLOAK_VERIFY_SSL=false
KEYCLOAK_JWKS_CACHE_TTL_SECONDS=300
CORS_ALLOW_ORIGINS=*
API_PREFIX=/api
```

`KEYCLOAK_EXPECTED_AUDIENCE`를 비우면 audience 검증은 비활성화됩니다.

## 실행
```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```
