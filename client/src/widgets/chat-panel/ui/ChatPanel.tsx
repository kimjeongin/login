import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import type { ChatUiMessage } from '../../../entities/chat/model/types';
import {
  MessagingClientError,
  requestChatSend,
} from '../../../shared/lib/messaging/client';
import { Button } from '../../../shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/ui/card';

interface ChatPanelProps {
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

export function ChatPanel({ onAuthRequired }: ChatPanelProps) {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isSending]);

  const canSubmit = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const startNewChat = () => {
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setError(null);
    setInput('');
  };

  const appendMessage = (role: ChatUiMessage['role'], text: string) => {
    setMessages((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        role,
        text,
        createdAt: Date.now(),
      },
    ]);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const prompt = input.trim();
    if (!prompt || isSending) {
      return;
    }

    setError(null);
    setInput('');
    appendMessage('user', prompt);
    setIsSending(true);

    try {
      const response = await requestChatSend({ text: prompt, sessionId });
      appendMessage('assistant', response.reply);
    } catch (err) {
      if (err instanceof MessagingClientError && err.code === 'AUTH_REQUIRED') {
        await onAuthRequired();
      }
      setError(toMessage(err, '챗봇 응답을 불러오지 못했습니다.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>챗봇 채팅</CardTitle>
            <CardDescription>Ollama(qwen3:8b) 기반 A2A 챗봇</CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={startNewChat} disabled={isSending}>
            새 대화
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={scrollRef}
          className="h-[280px] space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">메시지를 입력하면 대화를 시작합니다.</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-8 bg-slate-900 text-white'
                    : 'mr-8 border border-slate-200 bg-white text-slate-800'
                }`}
              >
                {message.text}
              </div>
            ))
          )}

          {isSending ? (
            <div className="mr-8 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
              응답 생성 중...
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {error}
          </p>
        ) : null}

        <form className="space-y-2" onSubmit={(event) => void onSubmit(event)}>
          <textarea
            className="min-h-[80px] w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 disabled:cursor-not-allowed disabled:opacity-50"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="챗봇에게 질문을 입력하세요."
            disabled={isSending}
          />
          <Button className="w-full" type="submit" disabled={!canSubmit}>
            {isSending ? '전송 중...' : '전송'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

