from functools import lru_cache

from app.core.settings import Settings
from app.projects.infrastructure.in_memory_project_repository import InMemoryProjectRepository
from app.projects.services.project_service import ProjectService


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_project_repository() -> InMemoryProjectRepository:
    return InMemoryProjectRepository()


@lru_cache
def get_project_service() -> ProjectService:
    return ProjectService(repository=get_project_repository())
