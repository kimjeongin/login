export interface ChatSendPayload {
  text: string;
  sessionId: string;
}

export interface ChatReply {
  reply: string;
  sessionId: string;
  taskId: string;
}

export interface ChatUiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

