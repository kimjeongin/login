from __future__ import annotations

from time import monotonic
from typing import Any

import httpx
from jose import JWTError, jwt

from app.auth.domain.exceptions import (
    IdentityProviderUnavailableError,
    UnauthorizedError,
)
from app.auth.domain.principal import AuthenticatedPrincipal


class KeycloakTokenVerifier:
    def __init__(
        self,
        *,
        issuer: str,
        audience: str | None,
        oidc_config_url: str,
        verify_ssl: bool,
        jwks_cache_ttl_seconds: int = 300,
    ) -> None:
        self._issuer = issuer
        self._audience = audience.strip() if isinstance(audience, str) else None
        if self._audience == "":
            self._audience = None
        self._oidc_config_url = oidc_config_url
        self._verify_ssl = verify_ssl
        self._jwks_cache_ttl_seconds = jwks_cache_ttl_seconds

        self._oidc_config: dict[str, Any] | None = None
        self._jwks: dict[str, Any] | None = None
        self._jwks_fetched_at: float = 0.0

    async def verify_access_token(self, access_token: str) -> AuthenticatedPrincipal:
        try:
            header = jwt.get_unverified_header(access_token)
            key_id = header.get("kid")
            claims = await self._decode_with_jwks(access_token, key_id)
        except JWTError as error:
            raise UnauthorizedError("Invalid or expired access token.") from error

        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject:
            raise UnauthorizedError("Token is missing subject.")

        username_claim = claims.get("preferred_username")
        username = username_claim if isinstance(username_claim, str) else None

        return AuthenticatedPrincipal(
            subject=subject,
            username=username,
            groups=self._extract_groups(claims),
            roles=self._extract_roles(claims),
            active_claim=self._extract_active_claim(claims),
        )

    async def _decode_with_jwks(
        self,
        access_token: str,
        key_id: str | None,
    ) -> dict[str, Any]:
        jwks = await self._load_jwks(force_refresh=False)
        claims = self._try_decode(access_token, key_id, jwks)
        if claims is not None:
            return claims

        # Key rotation can happen, refresh JWKS once and retry.
        jwks = await self._load_jwks(force_refresh=True)
        claims = self._try_decode(access_token, key_id, jwks)
        if claims is None:
            raise JWTError("Unable to decode token with available JWKS keys.")
        return claims

    def _try_decode(
        self,
        access_token: str,
        key_id: str | None,
        jwks: dict[str, Any],
    ) -> dict[str, Any] | None:
        keys = jwks.get("keys", [])
        if not isinstance(keys, list):
            return None

        candidates = [key for key in keys if isinstance(key, dict)]
        if key_id:
            candidates = [key for key in candidates if key.get("kid") == key_id]

        verify_aud = self._audience is not None
        for key in candidates:
            try:
                return jwt.decode(
                    access_token,
                    key,
                    algorithms=["RS256"],
                    issuer=self._issuer,
                    audience=self._audience,
                    options={"verify_aud": verify_aud},
                )
            except JWTError:
                continue
        return None

    async def _load_oidc_config(self) -> dict[str, Any]:
        if self._oidc_config is not None:
            return self._oidc_config

        try:
            async with httpx.AsyncClient(timeout=10.0, verify=self._verify_ssl) as client:
                response = await client.get(self._oidc_config_url)
                response.raise_for_status()
        except httpx.HTTPError as error:
            raise IdentityProviderUnavailableError(
                "Cannot load Keycloak OIDC configuration."
            ) from error

        payload = response.json()
        if not isinstance(payload, dict):
            raise IdentityProviderUnavailableError(
                "Keycloak OIDC configuration payload is invalid."
            )

        self._oidc_config = payload
        return payload

    async def _load_jwks(self, force_refresh: bool) -> dict[str, Any]:
        cache_is_valid = monotonic() - self._jwks_fetched_at < self._jwks_cache_ttl_seconds
        if not force_refresh and self._jwks is not None and cache_is_valid:
            return self._jwks

        oidc_config = await self._load_oidc_config()
        jwks_uri = oidc_config.get("jwks_uri")
        if not isinstance(jwks_uri, str) or not jwks_uri:
            raise IdentityProviderUnavailableError(
                "Keycloak OIDC config is missing jwks_uri."
            )

        try:
            async with httpx.AsyncClient(timeout=10.0, verify=self._verify_ssl) as client:
                response = await client.get(jwks_uri)
                response.raise_for_status()
        except httpx.HTTPError as error:
            raise IdentityProviderUnavailableError(
                "Cannot load Keycloak JWKS keys."
            ) from error

        payload = response.json()
        if not isinstance(payload, dict):
            raise IdentityProviderUnavailableError("Keycloak JWKS payload is invalid.")

        self._jwks = payload
        self._jwks_fetched_at = monotonic()
        return payload

    @staticmethod
    def _extract_groups(claims: dict[str, Any]) -> frozenset[str]:
        raw_groups = claims.get("groups", [])
        if not isinstance(raw_groups, list):
            return frozenset()
        return frozenset(group for group in raw_groups if isinstance(group, str))

    @staticmethod
    def _extract_roles(claims: dict[str, Any]) -> frozenset[str]:
        resource_access = claims.get("resource_access", {})
        if not isinstance(resource_access, dict):
            return frozenset()

        roles: set[str] = set()

        # Prefer roles for the authorized party client (azp) when available.
        authorized_party = claims.get("azp")
        if isinstance(authorized_party, str):
            azp_access = resource_access.get(authorized_party)
            if isinstance(azp_access, dict):
                azp_roles = azp_access.get("roles", [])
                if isinstance(azp_roles, list):
                    roles.update(role for role in azp_roles if isinstance(role, str))
                    return frozenset(roles)

        # Fallback: merge all client roles from resource_access.
        for access_data in resource_access.values():
            if not isinstance(access_data, dict):
                continue
            client_roles = access_data.get("roles", [])
            if isinstance(client_roles, list):
                roles.update(role for role in client_roles if isinstance(role, str))

        return frozenset(roles)

    @staticmethod
    def _extract_active_claim(claims: dict[str, Any]) -> bool | None:
        raw_active = claims.get("active")
        if isinstance(raw_active, bool):
            return raw_active
        if isinstance(raw_active, str):
            normalized = raw_active.strip().lower()
            if normalized in {"true", "1", "yes"}:
                return True
            if normalized in {"false", "0", "no"}:
                return False
        return None
