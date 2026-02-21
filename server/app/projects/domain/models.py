from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(slots=True, frozen=True)
class Project:
    id: str
    owner_subject: str
    name: str
    description: str | None
    created_at: datetime

