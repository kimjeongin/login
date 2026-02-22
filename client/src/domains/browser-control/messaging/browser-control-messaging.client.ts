import type { BrowserControlSendActionPayload } from '../../../entities/browser-control/model/types';
import { sendMessage } from '../../../shared/lib/messaging/runtime.client';

export function requestBrowserControlSseToken() {
  return sendMessage({ type: 'BROWSER_CONTROL_GET_SSE_TOKEN' });
}

export function requestBrowserControlSendAction(
  payload: BrowserControlSendActionPayload,
) {
  return sendMessage({ type: 'BROWSER_CONTROL_SEND_ACTION', payload });
}

