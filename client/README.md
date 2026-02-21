# Client (WXT + React Side Panel)

브라우저 확장 사이드패널 클라이언트입니다.

## 아키텍처
- FSD 구조로 분리 (`app/pages/widgets/features/entities/shared`)
- 인증/토큰 단일 권한 소스: `background service worker`
- sidepanel/content-script는 토큰 직접 접근 금지
- backend 호출은 background proxy 메시지 경유만 허용

## 토큰 정책
- Access Token: background 메모리 전용
- Refresh Token: `chrome.storage.session` 전용
- 브라우저 재시작 시 세션 종료
- content-script에는 토큰 전달 금지

## 로그인 흐름
1. sidepanel이 `AUTH_LOGIN` 메시지를 background로 전송
2. background가 `launchWebAuthFlow + PKCE` 수행
3. 토큰 교환 후 access token은 메모리, refresh token은 storage.session에 저장
4. 프로젝트 API 호출은 background가 access token으로 프록시 호출
5. 만료 시 background가 refresh 시도, 실패 시 `AUTH_REQUIRED` 반환

## 실행
```bash
pnpm install
pnpm compile
pnpm dev
```

## 참고
- Keycloak Redirect URI: `https://<EXTENSION_ID>.chromiumapp.org/*`
- 고정 extension id는 `manifest.key` 기반으로 유지됩니다.
