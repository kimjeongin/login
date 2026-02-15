from __future__ import annotations

from dataclasses import dataclass
from time import monotonic
from typing import Any

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.config import Settings


@dataclass(slots=True)
class AuthenticatedUser:
    sub: str
    preferred_username: str | None


class KeycloakService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._jwks: dict[str, Any] | None = None
        self._oidc_config: dict[str, Any] | None = None
        self._jwks_fetched_at: float = 0.0
        self._jwks_cache_seconds = 300

    async def verify_access_token(self, token: str) -> AuthenticatedUser:
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            claims = await self._decode_with_kid(token, kid)
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token.",
            ) from exc

        sub = claims.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing subject.",
            )

        return AuthenticatedUser(
            sub=sub,
            preferred_username=claims.get("preferred_username"),
        )

    async def _decode_with_kid(self, token: str, kid: str | None) -> dict[str, Any]:
        jwks = await self._get_jwks(force_refresh=False)
        claims = self._try_decode(token, kid, jwks)
        if claims is not None:
            return claims

        # Key rotation can happen, so force refresh once and retry.
        jwks = await self._get_jwks(force_refresh=True)
        claims = self._try_decode(token, kid, jwks)
        if claims is None:
            raise JWTError("Unable to decode token with available JWKS keys.")
        return claims

    def _try_decode(
        self,
        token: str,
        kid: str | None,
        jwks: dict[str, Any],
    ) -> dict[str, Any] | None:
        keys = jwks.get("keys", [])
        candidates = [key for key in keys if key.get("kid") == kid] if kid else keys

        for key in candidates:
            try:
                return jwt.decode(
                    token,
                    key,
                    algorithms=["RS256"],
                    issuer=self.settings.issuer_url,
                    options={"verify_aud": False},
                )
            except JWTError:
                continue
        return None

    async def _get_oidc_config(self) -> dict[str, Any]:
        if self._oidc_config is not None:
            return self._oidc_config

        try:
            async with httpx.AsyncClient(
                timeout=10.0,
                verify=self.settings.keycloak_verify_ssl,
            ) as client:
                response = await client.get(self.settings.oidc_config_url)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cannot load Keycloak OIDC configuration.",
            ) from exc

        self._oidc_config = response.json()
        return self._oidc_config

    async def _get_jwks(self, force_refresh: bool) -> dict[str, Any]:
        cache_valid = monotonic() - self._jwks_fetched_at < self._jwks_cache_seconds
        if not force_refresh and self._jwks is not None and cache_valid:
            return self._jwks

        oidc_config = await self._get_oidc_config()
        jwks_uri = oidc_config.get("jwks_uri")
        if not jwks_uri:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Keycloak OIDC config is missing jwks_uri.",
            )

        try:
            async with httpx.AsyncClient(
                timeout=10.0,
                verify=self.settings.keycloak_verify_ssl,
            ) as client:
                response = await client.get(jwks_uri)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cannot load Keycloak JWKS keys.",
            ) from exc

        self._jwks = response.json()
        self._jwks_fetched_at = monotonic()
        return self._jwks
