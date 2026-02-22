import type { ProjectCreatePayload } from '../../entities/project/model/types';
import type {
  ExtensionMessage,
  MessageResponse,
} from '../../shared/lib/messaging/contracts';
import {
  clearSession,
  getSessionView,
  loginSession,
  logoutSession,
} from './auth-session.service';
import { createBackgroundError, failure, success, toAppError } from './errors';
import { createProject, listProjects } from './project-api.proxy';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProjectCreatePayload(value: unknown): value is ProjectCreatePayload {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.name !== 'string') {
    return false;
  }

  if (
    typeof value.description !== 'undefined' &&
    typeof value.description !== 'string'
  ) {
    return false;
  }

  return true;
}

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!isObject(value) || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'AUTH_LOGIN':
    case 'AUTH_LOGOUT':
    case 'AUTH_GET_SESSION':
    case 'PROJECT_LIST':
      return true;
    case 'PROJECT_CREATE':
      return isProjectCreatePayload(value.payload);
    default:
      return false;
  }
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

type RouterHandler = (
  message: ExtensionMessage,
  sender: Browser.runtime.MessageSender,
) => Promise<MessageResponse<unknown>>;

const handlers: Record<ExtensionMessage['type'], RouterHandler> = {
  AUTH_LOGIN: async (_message, sender) => {
    if (!isLoginAllowedSender(sender)) {
      return failure(
        'FORBIDDEN_CONTEXT',
        'Login is only allowed from extension pages or content scripts.',
      );
    }
    return success(await loginSession());
  },
  AUTH_LOGOUT: async () => {
    await logoutSession();
    return success({ ok: true });
  },
  AUTH_GET_SESSION: async () => {
    return success(await getSessionView());
  },
  PROJECT_LIST: async () => {
    return success(await listProjects());
  },
  PROJECT_CREATE: async (message) => {
    const createMessage = message as Extract<
      ExtensionMessage,
      { type: 'PROJECT_CREATE' }
    >;
    const name = createMessage.payload.name.trim();
    if (!name) {
      throw createBackgroundError('VALIDATION', 'Project name is required.');
    }

    const payload: ProjectCreatePayload = {
      name,
      description: createMessage.payload.description?.trim(),
    };

    return success(await createProject(payload));
  },
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
