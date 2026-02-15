from functools import lru_cache

from app.config import Settings
from app.keycloak import KeycloakService
from app.storage import InMemoryProjectStore


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_keycloak_service() -> KeycloakService:
    return KeycloakService(get_settings())


@lru_cache
def get_project_store() -> InMemoryProjectStore:
    return InMemoryProjectStore()
