type SidePanelApi = {
  setPanelBehavior?: (options: {
    openPanelOnActionClick: boolean;
  }) => Promise<void> | void;
};

export default defineBackground(() => {
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
});
