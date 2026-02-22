from __future__ import annotations

import asyncio
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, UTC
from typing import Literal
from uuid import uuid4

BrowserControlAction = Literal["click", "popup", "close"]
EventQueue = asyncio.Queue["BrowserControlEvent"]

EVENT_QUEUE_MAX_SIZE = 100


@dataclass(slots=True, frozen=True)
class BrowserControlEvent:
    event_id: str
    owner_subject: str
    action: BrowserControlAction
    actor: str | None
    created_at: datetime


class BrowserControlEventService:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[EventQueue]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, owner_subject: str) -> EventQueue:
        queue: EventQueue = asyncio.Queue(maxsize=EVENT_QUEUE_MAX_SIZE)
        async with self._lock:
            self._subscribers[owner_subject].add(queue)
        return queue

    async def unsubscribe(self, owner_subject: str, queue: EventQueue) -> None:
        async with self._lock:
            subscribers = self._subscribers.get(owner_subject)
            if not subscribers:
                return

            subscribers.discard(queue)
            if not subscribers:
                self._subscribers.pop(owner_subject, None)

    async def publish_action(
        self,
        owner_subject: str,
        *,
        action: BrowserControlAction,
        actor: str | None,
    ) -> BrowserControlEvent:
        event = BrowserControlEvent(
            event_id=uuid4().hex,
            owner_subject=owner_subject,
            action=action,
            actor=actor,
            created_at=datetime.now(UTC),
        )

        async with self._lock:
            targets = tuple(self._subscribers.get(owner_subject, set()))

        for queue in targets:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            queue.put_nowait(event)

        return event

