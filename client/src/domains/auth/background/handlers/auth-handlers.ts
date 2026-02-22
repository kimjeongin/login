import { getSessionView, loginSession, logoutSession } from '../auth-session.service';
import {
  failure,
  success,
} from '../../../../shared/lib/messaging/background-errors';
import type { RouterHandlers } from '../../../../shared/lib/messaging/router.types';

interface CreateAuthHandlersOptions {
  isLoginAllowedSender: (sender: Browser.runtime.MessageSender) => boolean;
}

export function createAuthHandlers({
  isLoginAllowedSender,
}: CreateAuthHandlersOptions): RouterHandlers {
  return {
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
  };
}
