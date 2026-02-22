import type { ChatSendPayload } from '../../../../entities/chat/model/types';
import type { ExtensionMessage } from '../../../../shared/lib/messaging/contracts';
import {
  createBackgroundError,
  success,
} from '../../../../shared/lib/messaging/background-errors';
import type { RouterHandlers } from '../../../../shared/lib/messaging/router.types';
import { sendChatPrompt } from '../a2a-chat.client';

export function createChatHandlers(): RouterHandlers {
  return {
    CHAT_SEND: async (message) => {
      const chatMessage = message as Extract<
        ExtensionMessage,
        { type: 'CHAT_SEND' }
      >;

      const text = chatMessage.payload.text.trim();
      const sessionId = chatMessage.payload.sessionId.trim();
      if (!text) {
        throw createBackgroundError('VALIDATION', '메시지를 입력해주세요.');
      }
      if (!sessionId) {
        throw createBackgroundError('VALIDATION', '세션이 유효하지 않습니다.');
      }

      const payload: ChatSendPayload = { text, sessionId };
      return success(await sendChatPrompt(payload));
    },
  };
}

