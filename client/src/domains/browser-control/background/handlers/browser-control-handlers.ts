import type { BrowserControlSendActionPayload } from '../../../../entities/browser-control/model/types';
import type { ExtensionMessage } from '../../../../shared/lib/messaging/contracts';
import {
  createBackgroundError,
  success,
} from '../../../../shared/lib/messaging/background-errors';
import type { RouterHandlers } from '../../../../shared/lib/messaging/router.types';
import { ensureAccessToken } from '../../../auth/background/auth-session.service';
import { sendBrowserControlAction } from '../browser-control-api.client';

export function createBrowserControlHandlers(): RouterHandlers {
  return {
    BROWSER_CONTROL_GET_SSE_TOKEN: async () => {
      try {
        const accessToken = await ensureAccessToken();
        return success({ accessToken });
      } catch {
        throw createBackgroundError('AUTH_REQUIRED', 'A login session is required.');
      }
    },
    BROWSER_CONTROL_SEND_ACTION: async (message) => {
      const actionMessage = message as Extract<
        ExtensionMessage,
        { type: 'BROWSER_CONTROL_SEND_ACTION' }
      >;
      const action = actionMessage.payload.action;
      if (!['click', 'popup', 'close'].includes(action)) {
        throw createBackgroundError('VALIDATION', 'Unsupported action.');
      }

      const payload: BrowserControlSendActionPayload = { action };
      return success(await sendBrowserControlAction(payload));
    },
  };
}

