import { AppProviders } from '@/src/app/providers/AppProviders';
import { SidepanelPage } from '@/src/pages/sidepanel/ui/SidepanelPage';

function App() {
  return (
    <AppProviders>
      <SidepanelPage />
    </AppProviders>
  );
}

export default App;
