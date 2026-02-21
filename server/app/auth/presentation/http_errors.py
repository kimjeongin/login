from fastapi import HTTPException, status

from app.auth.domain.exceptions import (
    AuthError,
    ForbiddenError,
    IdentityProviderUnavailableError,
)


def to_http_exception(error: AuthError) -> HTTPException:
    if isinstance(error, ForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, IdentityProviderUnavailableError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        )
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error))
