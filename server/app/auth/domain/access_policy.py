from app.auth.domain.exceptions import ForbiddenError
from app.auth.domain.principal import AuthenticatedPrincipal


class RoleAccessPolicy:
    def __init__(self, required_role: str = "active") -> None:
        self._required_role = required_role.strip().lower()

    def ensure_required_role(self, principal: AuthenticatedPrincipal) -> None:
        if not self._required_role:
            raise ForbiddenError("Required active role is not configured.")
        if not principal.has_role(self._required_role):
            raise ForbiddenError(
                f"User must have '{self._required_role}' role."
            )
