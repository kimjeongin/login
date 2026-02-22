import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';

import type {
  BrowserControlAction,
  BrowserControlSseEvent,
} from '../../../entities/browser-control/model/types';
import { API_BASE_URL } from '../../../shared/config/env';
import {
  MessagingClientError,
  requestBrowserControlSendAction,
  requestBrowserControlSseToken,
} from '../../../shared/lib/messaging/client';
import { Button } from '../../../shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/ui/card';

type StreamStatus = 'idle' | 'connecting' | 'connected' | 'error';

const ACTIONS: BrowserControlAction[] = ['click', 'popup', 'close'];
const MAX_EVENTS = 60;
const SSE_URL = `${API_BASE_URL}/browser-control/events`;

interface BrowserControlPanelProps {
  onAuthRequired: () => Promise<void>;
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof MessagingClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function parseSseEvent(raw: string): BrowserControlSseEvent | null {
  try {
    const parsed = JSON.parse(raw) as Partial<BrowserControlSseEvent>;
    if (
      typeof parsed.event_id === 'string' &&
      typeof parsed.action === 'string' &&
      ['click', 'popup', 'close'].includes(parsed.action) &&
      typeof parsed.created_at === 'string'
    ) {
      return {
        event_id: parsed.event_id,
        action: parsed.action as BrowserControlAction,
        actor: typeof parsed.actor === 'string' ? parsed.actor : null,
        created_at: parsed.created_at,
      };
    }
  } catch {
    // Ignore parse errors and invalid events.
  }

  return null;
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function BrowserControlPanel({ onAuthRequired }: BrowserControlPanelProps) {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle');
  const [events, setEvents] = useState<BrowserControlSseEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sendingAction, setSendingAction] = useState<BrowserControlAction | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback((nextStatus: StreamStatus = 'idle') => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreamStatus(nextStatus);
  }, []);

  const appendEvent = useCallback((event: BrowserControlSseEvent) => {
    setEvents((previous) => [event, ...previous].slice(0, MAX_EVENTS));
  }, []);

  const startStream = useCallback(async () => {
    if (eventSourceRef.current) {
      return;
    }

    setError(null);
    setStreamStatus('connecting');

    try {
      const { accessToken } = await requestBrowserControlSseToken();
      const source = new EventSourcePolyfill(SSE_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        heartbeatTimeout: 120_000,
      });

      source.onopen = () => {
        setStreamStatus('connected');
      };

      source.onerror = () => {
        closeStream('error');
        setError('SSE 연결이 끊겼습니다. 다시 시작해주세요.');
      };

      source.addEventListener('control-action', (event) => {
        const messageEvent = event as MessageEvent<string>;
        const parsed = parseSseEvent(messageEvent.data);
        if (parsed) {
          appendEvent(parsed);
        }
      });

      eventSourceRef.current = source;
    } catch (err) {
      closeStream('error');
      if (err instanceof MessagingClientError && err.code === 'AUTH_REQUIRED') {
        await onAuthRequired();
      }
      setError(toMessage(err, 'SSE 연결을 시작하지 못했습니다.'));
    }
  }, [appendEvent, closeStream, onAuthRequired]);

  const stopStream = useCallback(() => {
    closeStream('idle');
  }, [closeStream]);

  useEffect(() => {
    return () => {
      closeStream('idle');
    };
  }, [closeStream]);

  const sendAction = useCallback(
    async (action: BrowserControlAction) => {
      setError(null);
      setSendingAction(action);
      try {
        await requestBrowserControlSendAction({ action });
      } catch (err) {
        if (err instanceof MessagingClientError && err.code === 'AUTH_REQUIRED') {
          await onAuthRequired();
        }
        setError(toMessage(err, '액션 요청을 전송하지 못했습니다.'));
      } finally {
        setSendingAction(null);
      }
    },
    [onAuthRequired],
  );

  const canSendActions = useMemo(
    () => streamStatus === 'connected' && !sendingAction,
    [streamStatus, sendingAction],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>브라우저 제어</CardTitle>
            <CardDescription>인증된 SSE 연결 후 액션 이벤트를 수신합니다.</CardDescription>
          </div>
          {streamStatus === 'connected' || streamStatus === 'connecting' ? (
            <Button variant="secondary" size="sm" onClick={stopStream}>
              중지
            </Button>
          ) : (
            <Button size="sm" onClick={() => void startStream()}>
              시작
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          상태:{' '}
          <span className="font-medium text-slate-700">
            {streamStatus === 'idle' && '대기'}
            {streamStatus === 'connecting' && '연결 중'}
            {streamStatus === 'connected' && '연결됨'}
            {streamStatus === 'error' && '오류'}
          </span>
        </p>

        <div className="grid grid-cols-3 gap-2">
          {ACTIONS.map((action) => (
            <Button
              key={action}
              variant="secondary"
              size="sm"
              disabled={!canSendActions}
              onClick={() => void sendAction(action)}
            >
              {sendingAction === action ? '전송 중...' : action}
            </Button>
          ))}
        </div>

        {error ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {error}
          </p>
        ) : null}

        <div className="h-[260px] space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">
              액션 이벤트가 없습니다. 연결 후 버튼을 눌러보세요.
            </p>
          ) : (
            events.map((event) => (
              <div
                key={event.event_id}
                className="rounded-md border border-slate-200 bg-white px-3 py-2"
              >
                <p className="text-sm font-semibold text-slate-900">{event.action}</p>
                <p className="mt-1 text-xs text-slate-500">
                  actor: {event.actor ?? 'unknown'}
                </p>
                <p className="text-[11px] text-slate-400">{formatDate(event.created_at)}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

