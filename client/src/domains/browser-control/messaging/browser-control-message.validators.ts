import type { BrowserControlSendActionPayload } from '../../../entities/browser-control/model/types';
import type { MessageValidators } from '../../../shared/lib/messaging/router.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasType(
  value: unknown,
  type: 'BROWSER_CONTROL_GET_SSE_TOKEN' | 'BROWSER_CONTROL_SEND_ACTION',
): boolean {
  return isObject(value) && value.type === type;
}

function isAction(value: unknown): value is BrowserControlSendActionPayload['action'] {
  return value === 'click' || value === 'popup' || value === 'close';
}

function isSendActionPayload(value: unknown): value is BrowserControlSendActionPayload {
  if (!isObject(value)) {
    return false;
  }
  return isAction(value.action);
}

export function createBrowserControlMessageValidators(): MessageValidators {
  return {
    BROWSER_CONTROL_GET_SSE_TOKEN: (value) =>
      hasType(value, 'BROWSER_CONTROL_GET_SSE_TOKEN'),
    BROWSER_CONTROL_SEND_ACTION: (value) => {
      if (!hasType(value, 'BROWSER_CONTROL_SEND_ACTION')) {
        return false;
      }
      return isSendActionPayload((value as { payload?: unknown }).payload);
    },
  };
}

