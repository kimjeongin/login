import type { ChatReply, ChatSendPayload } from '../../../entities/chat/model/types';

export type ChatMessage = { type: 'CHAT_SEND'; payload: ChatSendPayload };

export interface ChatMessageResultMap {
  CHAT_SEND: ChatReply;
}

