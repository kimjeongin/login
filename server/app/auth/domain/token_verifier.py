from typing import Protocol

from app.auth.domain.principal import AuthenticatedPrincipal


class TokenVerifier(Protocol):
    async def verify_access_token(self, access_token: str) -> AuthenticatedPrincipal:
        ...
