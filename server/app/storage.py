from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4


@dataclass(slots=True)
class ProjectRecord:
    id: str
    owner_sub: str
    name: str
    description: str | None
    created_at: datetime


class InMemoryProjectStore:
    def __init__(self) -> None:
        self._projects: dict[str, list[ProjectRecord]] = {}
        self._lock = Lock()

    def list_by_owner(self, owner_sub: str) -> list[ProjectRecord]:
        with self._lock:
            return list(self._projects.get(owner_sub, []))

    def create(self, owner_sub: str, name: str, description: str | None) -> ProjectRecord:
        record = ProjectRecord(
            id=str(uuid4()),
            owner_sub=owner_sub,
            name=name,
            description=description,
            created_at=datetime.now(timezone.utc),
        )
        with self._lock:
            self._projects.setdefault(owner_sub, []).insert(0, record)
        return record
