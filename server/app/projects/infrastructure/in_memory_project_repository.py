from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4

from app.projects.domain.models import Project


class InMemoryProjectRepository:
    def __init__(self) -> None:
        self._projects: dict[str, list[Project]] = {}
        self._lock = Lock()

    def list_by_owner(self, owner_subject: str) -> list[Project]:
        with self._lock:
            return list(self._projects.get(owner_subject, []))

    def create(
        self,
        owner_subject: str,
        name: str,
        description: str | None,
    ) -> Project:
        project = Project(
            id=str(uuid4()),
            owner_subject=owner_subject,
            name=name,
            description=description,
            created_at=datetime.now(timezone.utc),
        )
        with self._lock:
            self._projects.setdefault(owner_subject, []).insert(0, project)
        return project

