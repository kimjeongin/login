import type {
  ExtensionMessage,
  MessageResponse,
} from '../../shared/lib/messaging/contracts';
import { clearSession } from '../../domains/auth/background/auth-session.service';
import { createAuthHandlers } from '../../domains/auth/background/handlers/auth-handlers';
import { createAuthMessageValidators } from '../../domains/auth/messaging/auth-message.validators';
import { createChatHandlers } from '../../domains/chat/background/handlers/chat-handlers';
import { createChatMessageValidators } from '../../domains/chat/messaging/chat-message.validators';
import {
  createProjectHandlers,
} from '../../domains/projects/background/handlers/project-handlers';
import { createProjectMessageValidators } from '../../domains/projects/messaging/project-message.validators';
import {
  failure,
  toAppError,
} from '../../shared/lib/messaging/background-errors';
import type {
  MessageValidators,
  RouterHandlers,
} from '../../shared/lib/messaging/router.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!isObject(value) || typeof value.type !== 'string') {
    return false;
  }

  const validator =
    messageValidators[value.type as ExtensionMessage['type']];
  if (!validator) {
    return false;
  }

  return validator(value);
}

function isTrustedSender(sender: Browser.runtime.MessageSender): boolean {
  return sender.id === browser.runtime.id;
}

function isExtensionPageSender(sender: Browser.runtime.MessageSender): boolean {
  const url = sender.url;
  if (!url) {
    return false;
  }

  return url.startsWith(browser.runtime.getURL(''));
}

function isContentScriptSender(sender: Browser.runtime.MessageSender): boolean {
  return typeof sender.tab?.id === 'number';
}

function isLoginAllowedSender(sender: Browser.runtime.MessageSender): boolean {
  return isExtensionPageSender(sender) || isContentScriptSender(sender);
}

const handlers: RouterHandlers = {
  ...createAuthHandlers({ isLoginAllowedSender }),
  ...createChatHandlers(),
  ...createProjectHandlers(),
};

const messageValidators: MessageValidators = {
  ...createAuthMessageValidators(),
  ...createChatMessageValidators(),
  ...createProjectMessageValidators(),
};

async function handleMessage(
  message: ExtensionMessage,
  sender: Browser.runtime.MessageSender,
): Promise<MessageResponse<unknown>> {
  if (!isTrustedSender(sender)) {
    return failure('FORBIDDEN_CONTEXT', 'Untrusted sender.');
  }

  const handler = handlers[message.type];
  if (!handler) {
    return failure('VALIDATION', 'Unsupported message type.');
  }

  try {
    return await handler(message, sender);
  } catch (error) {
    const appError = toAppError(error, {
      code: 'NETWORK',
      message: 'Request failed.',
    });

    if (appError.code === 'AUTH_REQUIRED') {
      await clearSession();
    }

    return failure(appError.code, appError.message);
  }
}

export function registerMessageRouter(): void {
  browser.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    void (async () => {
      if (!isExtensionMessage(rawMessage)) {
        sendResponse(failure('VALIDATION', 'Invalid message payload.'));
        return;
      }

      const response = await handleMessage(rawMessage, sender);
      sendResponse(response);
    })();

    // Keep the channel open for async sendResponse in Chromium MV3.
    return true;
  });
}
