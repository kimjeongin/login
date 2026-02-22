from fastapi import Depends, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.dependencies import get_auth_service
from app.auth.domain.exceptions import (
    AuthError,
    UnauthorizedError,
)
from app.auth.domain.principal import AuthenticatedPrincipal
from app.auth.presentation.http_errors import to_http_exception
from app.auth.services.auth_service import AuthService

bearer_scheme = HTTPBearer(auto_error=False)


def _extract_bearer_token(credentials: HTTPAuthorizationCredentials | None) -> str:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Authorization bearer token is required.")
    return credentials.credentials


async def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthenticatedPrincipal:
    try:
        token = _extract_bearer_token(credentials)
        return await auth_service.authenticate(token)
    except AuthError as error:
        raise to_http_exception(error) from error


async def get_current_active_extension_principal(
    current_principal: AuthenticatedPrincipal = Depends(get_current_principal),
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthenticatedPrincipal:
    try:
        auth_service.authorize_extension_user(current_principal)
    except AuthError as error:
        raise to_http_exception(error) from error
    return current_principal
