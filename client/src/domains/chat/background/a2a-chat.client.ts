import { A2AClient } from '@a2a-js/sdk/client';

import type { ChatReply, ChatSendPayload } from '../../../entities/chat/model/types';
import { CHAT_A2A_HANDLER_NAME, API_BASE_URL } from '../../../shared/config/env';
import {
  BackgroundError,
  createBackgroundError,
} from '../../../shared/lib/messaging/background-errors';
import {
  ensureAccessToken,
  forceRefreshAccessToken,
} from '../../auth/background/auth-session.service';

const CHAT_A2A_BASE_URL = `${API_BASE_URL}/chat/a2a/${CHAT_A2A_HANDLER_NAME}`;
const CHAT_AGENT_CARD_PATH = '.well-known/agent.json';
const TASK_POLL_INTERVAL_MS = 300;
const TASK_POLL_LIMIT = 40;

interface JsonRpcErrorPayload {
  code?: number;
  message?: string;
  data?: unknown;
}

type JsonRpcResponse<T> = {
  jsonrpc?: '2.0';
  id?: string | number | null;
  result?: T;
  error?: JsonRpcErrorPayload;
};

interface A2ATaskStatus {
  state?: string;
}

interface A2ATextPart {
  type?: string;
  text?: string;
}

interface A2AArtifact {
  parts?: A2ATextPart[];
}

interface A2ATask {
  id?: string;
  status?: A2ATaskStatus;
  artifacts?: A2AArtifact[];
}

function withAccessTokenHeaders(
  requestInit: RequestInit | undefined,
  accessToken: string,
): Headers {
  const headers = new Headers(requestInit?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (requestInit?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

async function fetchWithAccessToken(
  input: RequestInfo | URL,
  requestInit: RequestInit | undefined,
  accessToken: string,
): Promise<Response> {
  try {
    return await fetch(input, {
      ...requestInit,
      headers: withAccessTokenHeaders(requestInit, accessToken),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.';
    throw createBackgroundError('NETWORK', message);
  }
}

function rebuildResponse(original: Response, body: string): Response {
  const headers = new Headers(original.headers);
  headers.delete('content-length');
  return new Response(body, {
    status: original.status,
    statusText: original.statusText,
    headers,
  });
}

async function sanitizeJsonRpcNullError(response: Response): Promise<Response> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return response;
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch {
    return response;
  }

  if (!raw) {
    return rebuildResponse(response, raw);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      (parsed as { error?: unknown }).error === null &&
      'result' in parsed
    ) {
      delete (parsed as Record<string, unknown>).error;
      return rebuildResponse(response, JSON.stringify(parsed));
    }
  } catch {
    return rebuildResponse(response, raw);
  }

  return rebuildResponse(response, raw);
}

async function fetchWithAuthorizedRetry(
  input: RequestInfo | URL,
  requestInit: RequestInit | undefined,
): Promise<Response> {
  let accessToken: string;
  try {
    accessToken = await ensureAccessToken();
  } catch {
    throw createBackgroundError('AUTH_REQUIRED', 'A login session is required.');
  }

  let response = await fetchWithAccessToken(input, requestInit, accessToken);
  response = await sanitizeJsonRpcNullError(response);
  if (response.status === 403) {
    throw createBackgroundError('FORBIDDEN', '채팅 요청 권한이 없습니다.');
  }
  if (response.status !== 401) {
    return response;
  }

  try {
    accessToken = await forceRefreshAccessToken();
  } catch {
    throw createBackgroundError('AUTH_REQUIRED', 'Session expired. Please login again.');
  }

  response = await fetchWithAccessToken(input, requestInit, accessToken);
  response = await sanitizeJsonRpcNullError(response);
  if (response.status === 401) {
    throw createBackgroundError('AUTH_REQUIRED', 'Session expired. Please login again.');
  }
  if (response.status === 403) {
    throw createBackgroundError('FORBIDDEN', '채팅 요청 권한이 없습니다.');
  }

  return response;
}

function createA2AClient(): A2AClient {
  return new A2AClient(CHAT_A2A_BASE_URL, {
    agentCardPath: CHAT_AGENT_CARD_PATH,
    fetchImpl: fetchWithAuthorizedRetry,
  });
}

function readJsonRpcResult<T>(response: JsonRpcResponse<T>): T {
  if (response.error) {
    const message =
      typeof response.error.message === 'string'
        ? response.error.message
        : 'A2A request failed.';
    throw createBackgroundError('NETWORK', message);
  }

  if (typeof response.result === 'undefined') {
    throw createBackgroundError('NETWORK', 'A2A response is missing result payload.');
  }

  return response.result;
}

function extractTaskId(task: A2ATask): string {
  if (typeof task.id !== 'string' || !task.id) {
    throw createBackgroundError('NETWORK', 'A2A response is missing task id.');
  }
  return task.id;
}

function extractArtifactText(task: A2ATask): string | null {
  const artifacts = task.artifacts ?? [];
  for (let i = artifacts.length - 1; i >= 0; i -= 1) {
    const parts = artifacts[i]?.parts ?? [];
    for (let j = parts.length - 1; j >= 0; j -= 1) {
      const part = parts[j];
      if (part?.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return null;
}

function isTaskCompleted(task: A2ATask): boolean {
  return task.status?.state === 'completed';
}

function isTaskTerminalFailure(task: A2ATask): boolean {
  return ['failed', 'canceled', 'rejected', 'auth-required', 'unknown'].includes(
    task.status?.state ?? '',
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollTaskUntilComplete(client: A2AClient, taskId: string): Promise<A2ATask> {
  for (let attempt = 0; attempt < TASK_POLL_LIMIT; attempt += 1) {
    const taskResponse = await client.callExtensionMethod<
      { id: string },
      any
    >('tasks/get', { id: taskId });
    const task = readJsonRpcResult<A2ATask>(
      taskResponse as JsonRpcResponse<A2ATask>,
    );

    if (isTaskCompleted(task)) {
      return task;
    }

    if (isTaskTerminalFailure(task)) {
      throw createBackgroundError(
        'NETWORK',
        `A2A task finished with state: ${task.status?.state ?? 'unknown'}.`,
      );
    }

    await delay(TASK_POLL_INTERVAL_MS);
  }

  throw createBackgroundError('NETWORK', 'A2A response timed out.');
}

function toBackgroundError(error: unknown): BackgroundError {
  if (error instanceof BackgroundError) {
    return error;
  }

  if (error instanceof Error) {
    return createBackgroundError('NETWORK', error.message);
  }

  return createBackgroundError('NETWORK', 'A2A request failed.');
}

export async function sendChatPrompt(payload: ChatSendPayload): Promise<ChatReply> {
  const prompt = payload.text.trim();
  const sessionId = payload.sessionId.trim();
  if (!prompt) {
    throw createBackgroundError('VALIDATION', '메시지를 입력해주세요.');
  }
  if (!sessionId) {
    throw createBackgroundError('VALIDATION', '세션 정보가 유효하지 않습니다.');
  }

  const client = createA2AClient();

  try {
    const sendResponse = await client.callExtensionMethod<
      {
        id: string;
        sessionId: string;
        message: {
          role: 'user';
          parts: Array<{ type: 'text'; text: string }>;
        };
      },
      any
    >('tasks/send', {
      id: crypto.randomUUID(),
      sessionId,
      message: {
        role: 'user',
        parts: [{ type: 'text', text: prompt }],
      },
    });

    const task = readJsonRpcResult<A2ATask>(
      sendResponse as JsonRpcResponse<A2ATask>,
    );
    const taskId = extractTaskId(task);
    const completedTask = await pollTaskUntilComplete(client, taskId);
    const reply = extractArtifactText(completedTask);
    if (!reply) {
      throw createBackgroundError('NETWORK', '챗봇 응답을 파싱하지 못했습니다.');
    }

    return {
      reply,
      sessionId,
      taskId,
    };
  } catch (error) {
    throw toBackgroundError(error);
  }
}
