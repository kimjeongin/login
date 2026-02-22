import type { ChatSendPayload } from '../../../entities/chat/model/types';
import { sendMessage } from '../../../shared/lib/messaging/runtime.client';

export function requestChatSend(payload: ChatSendPayload) {
  return sendMessage({ type: 'CHAT_SEND', payload });
}

