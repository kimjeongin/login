from app.auth.domain.access_policy import RoleAccessPolicy
from app.auth.infrastructure.keycloak_token_verifier import KeycloakTokenVerifier
from app.auth.services.auth_service import AuthService
from app.core.settings import Settings


def build_keycloak_token_verifier(settings: Settings) -> KeycloakTokenVerifier:
    return KeycloakTokenVerifier(
        issuer=settings.issuer_url,
        audience=settings.keycloak_audience,
        oidc_config_url=settings.oidc_config_url,
        verify_ssl=settings.keycloak_verify_ssl,
        jwks_cache_ttl_seconds=settings.keycloak_jwks_cache_ttl_seconds,
    )


def build_access_policy(settings: Settings) -> RoleAccessPolicy:
    return RoleAccessPolicy(required_role=settings.required_role)


def build_auth_service(settings: Settings) -> AuthService:
    return AuthService(
        token_verifier=build_keycloak_token_verifier(settings),
        access_policy=build_access_policy(settings),
    )
