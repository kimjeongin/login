class AuthError(Exception):
    """Base exception for auth failures."""


class UnauthorizedError(AuthError):
    """Raised when token is missing or invalid."""


class ForbiddenError(AuthError):
    """Raised when authenticated user does not satisfy policy."""


class IdentityProviderUnavailableError(AuthError):
    """Raised when upstream identity provider metadata/JWKS is unavailable."""

