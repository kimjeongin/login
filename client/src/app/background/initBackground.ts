import { initializeSessionStoragePolicy } from '../../domains/auth/background/auth-session.service';
import { registerMessageRouter } from './message-router';

type SidePanelApi = {
  setPanelBehavior?: (options: {
    openPanelOnActionClick: boolean;
  }) => Promise<void> | void;
};

export function initBackground(): void {
  const browserWithSidePanel = browser as typeof browser & {
    sidePanel?: SidePanelApi;
  };

  const setupSidePanel = () => {
    void browserWithSidePanel.sidePanel?.setPanelBehavior?.({
      openPanelOnActionClick: true,
    });
  };

  setupSidePanel();
  browser.runtime.onInstalled.addListener(setupSidePanel);

  void initializeSessionStoragePolicy().catch(() => {
    // Keep worker functional even if access-level API is unavailable.
  });
  registerMessageRouter();
}
