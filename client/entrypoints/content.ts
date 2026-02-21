import type { SessionView } from '@/src/entities/auth/model/types';
import type { MessageResponse } from '@/src/shared/lib/messaging/contracts';

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    void browser.runtime
      .sendMessage({ type: 'AUTH_GET_SESSION' })
      .then((response) => response as MessageResponse<SessionView> | undefined)
      .then((response) => {
        if (!response || !response.ok) {
          return;
        }

        console.debug('[content] auth session available:', response.data.isAuthenticated);
      })
      .catch(() => {
        // Ignore content-side probe failures.
      });
  },
});
