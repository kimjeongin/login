from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.browser_control.services.browser_control_event_service import BrowserControlEvent

BrowserControlAction = Literal["click", "popup", "close"]


class BrowserControlActionRequest(BaseModel):
    action: BrowserControlAction


class BrowserControlActionResponse(BaseModel):
    ok: bool
    action: BrowserControlAction
    dispatched_at: datetime


class BrowserControlEventResponse(BaseModel):
    event_id: str
    action: BrowserControlAction
    actor: str | None
    created_at: datetime

    @classmethod
    def from_domain(cls, event: BrowserControlEvent) -> "BrowserControlEventResponse":
        return cls(
            event_id=event.event_id,
            action=event.action,
            actor=event.actor,
            created_at=event.created_at,
        )

