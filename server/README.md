# Server (FastAPI + Keycloak JWKS Validation)

브라우저 확장용 프로젝트 API 서버입니다.

## 제공 API
- `GET /health`
- `GET /api/projects` (인증 필요)
- `POST /api/projects` (인증 필요)

프로젝트 데이터는 테스트용 인메모리 저장소를 사용합니다.

## 인증 흐름
1. 클라이언트가 Keycloak에서 access token을 직접 발급받음
2. 클라이언트가 `Authorization: Bearer <token>`으로 서버 호출
3. 서버가 Keycloak OIDC 설정/JWKS를 조회해서 토큰 유효성 검증
4. 토큰 만료/무효 시 401 반환

JWKS는 서버 메모리에 캐시되고, 검증 실패 시 1회 강제 갱신 후 재검증합니다.

## Keycloak 설정
기본값:
- Base URL: `http://localhost:8080`
- Realm: `test`

## 환경변수
`.env.example`를 참고해 `.env`를 만드세요.

```bash
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=test
KEYCLOAK_VERIFY_SSL=false
CORS_ALLOW_ORIGINS=*
API_PREFIX=/api
```

## 실행
```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```
