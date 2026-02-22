# Server Auth Copy-Paste Guide

대상: FastAPI 기반 API 서버 프로젝트

## 1) 복사할 파일
아래 경로를 그대로 복사합니다.

```text
app/auth/
```

그리고 아래 연결 파일을 함께 반영합니다.

```text
app/core/settings.py
app/core/dependencies.py
app/projects/presentation/router.py   # 또는 보호할 다른 라우터 파일
```

## 2) 필수 의존성
`pyproject.toml`에 아래가 있는지 확인합니다.

- `fastapi[standard]`
- `httpx`
- `pydantic-settings`
- `python-jose[cryptography]`

## 3) 환경변수 추가
`server/.env`에 아래 키를 맞춥니다.

```env
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=test
KEYCLOAK_EXPECTED_AUDIENCE=your-api-audience
KEYCLOAK_VERIFY_SSL=false
KEYCLOAK_JWKS_CACHE_TTL_SECONDS=300
AUTH_REQUIRED_ROLE=active
CORS_ALLOW_ORIGINS=*
API_PREFIX=/api
```

`KEYCLOAK_EXPECTED_AUDIENCE`는 access token의 `aud`와 일치해야 합니다.  
개발 중 임시 우회를 원하면 빈 값으로 둘 수 있습니다.

## 4) 라우터 보호 방식
보호할 엔드포인트에서 아래 dependency를 사용합니다.

```py
from app.auth.presentation.dependencies import get_current_authorized_principal
```

예시:

```py
CurrentPrincipal = Annotated[
    AuthenticatedPrincipal,
    Depends(get_current_authorized_principal),
]
```

## 5) 권한 정책 변경 포인트
required role을 바꾸려면 `AUTH_REQUIRED_ROLE`만 바꾸면 됩니다.

예:

```env
AUTH_REQUIRED_ROLE=member
```

## 6) 점검 체크리스트
1. 유효 토큰으로 호출 시 `200`
2. 토큰 누락/만료/서명 오류 시 `401`
3. role 불일치 시 `403`
4. Keycloak 연결 불가 시 `503`
