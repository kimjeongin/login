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

현재 프로젝트처럼 A2A 채팅까지 함께 쓸 경우 아래도 같이 반영합니다.

```text
app/chat/infrastructure/a2a_app_factory.py
app/chat/infrastructure/langchain_chat_handler.py
app/main.py                           # app.mount("/api/chat/a2a", ...)
```

## 2) 필수 의존성
`pyproject.toml`에 아래가 있는지 확인합니다.

- `fastapi[standard]`
- `httpx`
- `pydantic-settings`
- `python-jose[cryptography]`
- `a2a-server`
- `a2a-json-rpc==0.3` (a2a-server와 호환 고정)
- `langchain`
- `langchain-ollama`

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
CHAT_A2A_HANDLER_NAME=chatbot
CHAT_OLLAMA_BASE_URL=http://localhost:11434
CHAT_OLLAMA_MODEL=qwen3:8b
CHAT_OLLAMA_TEMPERATURE=0.2
CHAT_RESPONSE_TIMEOUT_SECONDS=60
CHAT_HISTORY_MAX_MESSAGES=12
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

## 7) A2A 엔드포인트 인증 적용
A2A를 추가할 때도 인증 정책은 동일해야 합니다.

1. A2A sub-app 내부 middleware에서 bearer token 검증
2. `auth_service.authenticate()` + `auth_service.authorize_user()` 호출
3. 실패 시 `401`/`403` JSON 응답

mount 예시:

```py
app.mount(f"{settings.api_prefix}/chat/a2a", create_chat_a2a_app(settings))
```

## 8) A2A 채팅 인증 이식
다른 프로젝트로 A2A 인증 구현을 옮길 때는 아래 문서를 함께 참고합니다.

- `a2a-auth-copy-paste.md`
