from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.auth.dependencies import get_auth_service
from app.auth.domain.exceptions import AuthError, UnauthorizedError
from app.auth.presentation.http_errors import to_http_exception
from app.chat.infrastructure.langchain_chat_handler import LangChainOllamaTaskHandler
from app.core.settings import Settings


def _extract_bearer_token(request: Request) -> str:
    authorization = request.headers.get("authorization")
    if not authorization:
        raise UnauthorizedError("Authorization bearer token is required.")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("Authorization bearer token is required.")

    return token


def create_chat_a2a_app(settings: Settings) -> FastAPI:
    from a2a_server import create_app as create_a2a_server_app

    handler_name = settings.chat_handler_name
    handler_mount_path = f"{settings.api_prefix}/chat/a2a/{handler_name}"
    chat_handler = LangChainOllamaTaskHandler(
        name=handler_name,
        model=settings.chat_ollama_model,
        base_url=settings.chat_ollama_base_url,
        temperature=settings.chat_ollama_temperature,
        timeout_seconds=settings.chat_response_timeout_seconds,
        max_history_messages=settings.chat_history_max_messages,
        system_prompt=settings.chat_system_prompt,
    )

    a2a_app = create_a2a_server_app(
        handlers=[chat_handler],
        handlers_config={
            "default_handler": handler_name,
            handler_name: {
                "agent_card": {
                    "name": "Sidepanel Chat Agent",
                    "description": "Authenticated chat agent for the sidepanel.",
                    # a2a-server currently drops mount prefix while resolving handler card URL.
                    # Force absolute path so @a2a-js/sdk calls the correct mounted endpoint.
                    "url": handler_mount_path,
                    "skills": [
                        {
                            "id": "chat",
                            "name": "Chat",
                            "description": "General chat in Korean",
                            "tags": ["chat", "assistant", "korean"],
                        }
                    ],
                }
            },
        },
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        config={"cors": {"enabled": False}},
    )

    auth_service = get_auth_service()

    @a2a_app.middleware("http")
    async def require_authenticated_user(request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        try:
            token = _extract_bearer_token(request)
            principal = await auth_service.authenticate(token)
            auth_service.authorize_user(principal)
            request.state.principal = principal
        except AuthError as error:
            http_error = to_http_exception(error)
            return JSONResponse(
                status_code=http_error.status_code,
                content={"detail": http_error.detail},
            )

        return await call_next(request)

    return a2a_app
