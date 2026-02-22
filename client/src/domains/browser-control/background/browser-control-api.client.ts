import type {
  BrowserControlSendActionPayload,
  BrowserControlSendActionResponse,
} from '../../../entities/browser-control/model/types';
import { requestAuthorizedJson } from '../../../shared/api/authorized-api.client';

export function sendBrowserControlAction(
  payload: BrowserControlSendActionPayload,
): Promise<BrowserControlSendActionResponse> {
  return requestAuthorizedJson<BrowserControlSendActionResponse>(
    '/browser-control/actions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

