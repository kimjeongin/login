from functools import lru_cache

from app.auth.domain.access_policy import ExtensionAccessPolicy
from app.auth.infrastructure.keycloak_token_verifier import KeycloakTokenVerifier
from app.auth.services.auth_service import AuthService
from app.core.settings import Settings
from app.projects.infrastructure.in_memory_project_repository import InMemoryProjectRepository
from app.projects.services.project_service import ProjectService


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_keycloak_token_verifier() -> KeycloakTokenVerifier:
    settings = get_settings()
    return KeycloakTokenVerifier(
        issuer=settings.issuer_url,
        audience=settings.keycloak_audience,
        oidc_config_url=settings.oidc_config_url,
        verify_ssl=settings.keycloak_verify_ssl,
        jwks_cache_ttl_seconds=settings.keycloak_jwks_cache_ttl_seconds,
    )


@lru_cache
def get_extension_access_policy() -> ExtensionAccessPolicy:
    return ExtensionAccessPolicy(required_role="active")


@lru_cache
def get_auth_service() -> AuthService:
    return AuthService(
        token_verifier=get_keycloak_token_verifier(),
        access_policy=get_extension_access_policy(),
    )


@lru_cache
def get_project_repository() -> InMemoryProjectRepository:
    return InMemoryProjectRepository()


@lru_cache
def get_project_service() -> ProjectService:
    return ProjectService(repository=get_project_repository())
