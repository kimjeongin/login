import type { ChatSendPayload } from '../../../entities/chat/model/types';
import type { MessageValidators } from '../../../shared/lib/messaging/router.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasType(value: unknown, type: 'CHAT_SEND'): boolean {
  return isObject(value) && value.type === type;
}

function isChatSendPayload(value: unknown): value is ChatSendPayload {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.text === 'string' && typeof value.sessionId === 'string';
}

export function createChatMessageValidators(): MessageValidators {
  return {
    CHAT_SEND: (value) => {
      if (!hasType(value, 'CHAT_SEND')) {
        return false;
      }

      return isChatSendPayload((value as { payload?: unknown }).payload);
    },
  };
}

