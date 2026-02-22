from app.auth.domain.access_policy import RoleAccessPolicy
from app.auth.domain.principal import AuthenticatedPrincipal
from app.auth.domain.token_verifier import TokenVerifier


class AuthService:
    def __init__(
        self,
        token_verifier: TokenVerifier,
        access_policy: RoleAccessPolicy,
    ) -> None:
        self._token_verifier = token_verifier
        self._access_policy = access_policy

    async def authenticate(self, access_token: str) -> AuthenticatedPrincipal:
        return await self._token_verifier.verify_access_token(access_token)

    def authorize_user(self, principal: AuthenticatedPrincipal) -> None:
        self._access_policy.ensure_required_role(principal)
