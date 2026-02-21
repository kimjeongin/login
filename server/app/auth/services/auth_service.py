from app.auth.domain.access_policy import ExtensionAccessPolicy
from app.auth.domain.principal import AuthenticatedPrincipal
from app.auth.infrastructure.keycloak_token_verifier import KeycloakTokenVerifier


class AuthService:
    def __init__(
        self,
        token_verifier: KeycloakTokenVerifier,
        access_policy: ExtensionAccessPolicy,
    ) -> None:
        self._token_verifier = token_verifier
        self._access_policy = access_policy

    async def authenticate(self, access_token: str) -> AuthenticatedPrincipal:
        return await self._token_verifier.verify_access_token(access_token)

    def authorize_extension_user(self, principal: AuthenticatedPrincipal) -> None:
        self._access_policy.ensure_active_extension_user(principal)

