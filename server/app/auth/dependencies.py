from functools import lru_cache

from app.auth.factory import build_auth_service
from app.auth.services.auth_service import AuthService
from app.core.dependencies import get_settings


@lru_cache
def get_auth_service() -> AuthService:
    return build_auth_service(get_settings())
