from __future__ import annotations

import asyncio
import json
from datetime import datetime, UTC
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.auth.domain.principal import AuthenticatedPrincipal
from app.auth.presentation.dependencies import get_current_authorized_principal
from app.browser_control.presentation.schemas import (
    BrowserControlActionRequest,
    BrowserControlActionResponse,
    BrowserControlEventResponse,
)
from app.browser_control.services.browser_control_event_service import BrowserControlEventService
from app.core.dependencies import get_browser_control_event_service

router = APIRouter(prefix="/browser-control", tags=["browser-control"])

CurrentPrincipal = Annotated[
    AuthenticatedPrincipal,
    Depends(get_current_authorized_principal),
]
BrowserControlEventServiceDep = Annotated[
    BrowserControlEventService,
    Depends(get_browser_control_event_service),
]

SSE_KEEPALIVE_SECONDS = 20.0


def _to_sse_line(*, event: str, data: str) -> str:
    return f"event: {event}\ndata: {data}\n\n"


@router.get("/events")
async def stream_browser_control_events(
    current_principal: CurrentPrincipal,
    event_service: BrowserControlEventServiceDep,
) -> StreamingResponse:
    queue = await event_service.subscribe(current_principal.subject)

    async def event_generator() -> AsyncGenerator[str, None]:
        connected_payload = json.dumps(
            {"connected_at": datetime.now(UTC).isoformat()}
        )
        yield _to_sse_line(event="connected", data=connected_payload)

        try:
            while True:
                try:
                    event = await asyncio.wait_for(
                        queue.get(),
                        timeout=SSE_KEEPALIVE_SECONDS,
                    )
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue

                payload = BrowserControlEventResponse.from_domain(event).model_dump_json()
                yield _to_sse_line(event="control-action", data=payload)
        finally:
            await event_service.unsubscribe(current_principal.subject, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/actions", response_model=BrowserControlActionResponse)
async def dispatch_browser_control_action(
    payload: BrowserControlActionRequest,
    current_principal: CurrentPrincipal,
    event_service: BrowserControlEventServiceDep,
) -> BrowserControlActionResponse:
    event = await event_service.publish_action(
        current_principal.subject,
        action=payload.action,
        actor=current_principal.username,
    )
    return BrowserControlActionResponse(
        ok=True,
        action=event.action,
        dispatched_at=event.created_at,
    )

