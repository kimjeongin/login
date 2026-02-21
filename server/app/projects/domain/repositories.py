from typing import Protocol

from app.projects.domain.models import Project


class ProjectRepository(Protocol):
    def list_by_owner(self, owner_subject: str) -> list[Project]:
        ...

    def create(
        self,
        owner_subject: str,
        name: str,
        description: str | None,
    ) -> Project:
        ...

