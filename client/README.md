# Client (WXT + React Side Panel)

브라우저 확장 **사이드패널**에서 Keycloak 로그인 후 프로젝트를 관리하는 UI입니다.

## Stack
- WXT
- React
- Tailwind CSS v4
- shadcn 스타일 UI 컴포넌트

## 로그인/인증 흐름
1. 사이드패널에서 `chrome.identity.launchWebAuthFlow`로 Keycloak 로그인 시작
2. 리다이렉트 URI: `https://<EXTENSION_ID>.chromiumapp.org/*`
3. 인가 코드(code) 수신 후 PKCE(`code_verifier`)로 토큰 교환
4. 프로젝트 API 호출 시 access token을 Bearer로 전송
5. 백엔드가 Keycloak JWKS로 토큰 서명/유효성 검증
6. 토큰 만료/무효면 401을 받고 클라이언트가 재로그인 유도

## Keycloak 클라이언트 권장 설정
- Client Type: Public
- Standard Flow Enabled: ON
- Direct Access Grants: OFF (선택)
- Valid Redirect URIs: `https://<EXTENSION_ID>.chromiumapp.org/*`
- Web Origins: 개발 중에는 `*` 또는 필요한 Origin만 허용

## 환경변수
`.env.example`를 참고해 `.env`를 만드세요.

```bash
WXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
WXT_PUBLIC_KEYCLOAK_BASE_URL=http://localhost:8080
WXT_PUBLIC_KEYCLOAK_REALM=test
WXT_PUBLIC_KEYCLOAK_CLIENT_ID=extension-client
```

## 실행
```bash
pnpm install
pnpm dev
```

## 사용
확장 아이콘 클릭 시 사이드패널이 열립니다.
