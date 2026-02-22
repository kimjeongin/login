from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any, AsyncIterable

from a2a_json_rpc.spec import (
    Artifact,
    Message,
    TaskArtifactUpdateEvent,
    TaskState,
    TaskStatus,
    TaskStatusUpdateEvent,
    TextPart,
)
from a2a_server.tasks.handlers.task_handler import TaskHandler
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

logger = logging.getLogger(__name__)


class LangChainOllamaTaskHandler(TaskHandler):
    def __init__(
        self,
        *,
        name: str,
        model: str,
        base_url: str,
        temperature: float,
        timeout_seconds: float,
        max_history_messages: int,
        system_prompt: str,
    ) -> None:
        self._name = name
        self._chat_model = ChatOllama(
            model=model,
            base_url=base_url,
            temperature=temperature,
            request_timeout=timeout_seconds,
        )
        self._system_message = SystemMessage(content=system_prompt)
        self._history_limit = max_history_messages * 2
        self._session_messages: dict[str, list[BaseMessage]] = defaultdict(list)
        self._session_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    @property
    def name(self) -> str:
        return self._name

    async def process_task(
        self,
        task_id: str,
        message: Message,
        session_id: str | None = None,
    ) -> AsyncIterable[TaskStatusUpdateEvent | TaskArtifactUpdateEvent]:
        yield TaskStatusUpdateEvent(
            id=task_id,
            status=TaskStatus(state=TaskState.working),
            final=False,
        )

        prompt = self._extract_user_text(message).strip()
        if not prompt:
            yield TaskArtifactUpdateEvent(
                id=task_id,
                artifact=Artifact(
                    name="assistant-response",
                    parts=[TextPart(type="text", text="메시지를 입력해주세요.")],
                    index=0,
                ),
            )
            yield TaskStatusUpdateEvent(
                id=task_id,
                status=TaskStatus(state=TaskState.failed),
                final=True,
            )
            return

        session_key = (session_id or "default").strip() or "default"

        try:
            answer = await self._generate_answer(session_key, prompt)
        except Exception:
            logger.exception("Failed to generate LLM answer.")
            yield TaskArtifactUpdateEvent(
                id=task_id,
                artifact=Artifact(
                    name="assistant-response",
                    parts=[
                        TextPart(
                            type="text",
                            text="챗봇 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
                        )
                    ],
                    index=0,
                ),
            )
            yield TaskStatusUpdateEvent(
                id=task_id,
                status=TaskStatus(state=TaskState.failed),
                final=True,
            )
            return

        yield TaskArtifactUpdateEvent(
            id=task_id,
            artifact=Artifact(
                name="assistant-response",
                parts=[TextPart(type="text", text=answer)],
                index=0,
            ),
        )
        yield TaskStatusUpdateEvent(
            id=task_id,
            status=TaskStatus(state=TaskState.completed),
            final=True,
        )

    async def _generate_answer(self, session_key: str, prompt: str) -> str:
        async with self._session_locks[session_key]:
            history = self._session_messages[session_key]
            input_message = HumanMessage(content=prompt)
            result = await self._chat_model.ainvoke(
                [self._system_message, *history, input_message],
            )
            output = self._normalize_output(result.content)
            history.extend([input_message, AIMessage(content=output)])
            if len(history) > self._history_limit:
                del history[:-self._history_limit]
            return output

    @staticmethod
    def _extract_user_text(message: Message) -> str:
        texts: list[str] = []
        for part in message.parts:
            raw = part.model_dump(exclude_none=True)
            text = raw.get("text")
            if raw.get("type") == "text" and isinstance(text, str):
                cleaned = text.strip()
                if cleaned:
                    texts.append(cleaned)
        return "\n".join(texts)

    @staticmethod
    def _normalize_output(content: Any) -> str:
        if isinstance(content, str):
            text = content.strip()
            return text or "응답이 비어 있습니다."

        if isinstance(content, list):
            chunks: list[str] = []
            for item in content:
                if isinstance(item, str):
                    chunks.append(item)
                elif isinstance(item, dict):
                    value = item.get("text")
                    if isinstance(value, str):
                        chunks.append(value)
            text = "\n".join(chunk.strip() for chunk in chunks if chunk.strip()).strip()
            if text:
                return text

        text = str(content).strip()
        return text or "응답이 비어 있습니다."

