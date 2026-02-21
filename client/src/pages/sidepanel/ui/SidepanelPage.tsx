import { AuthGate } from '../../../widgets/auth-gate/ui/AuthGate';

export function SidepanelPage() {
  return (
    <div className="flex h-full min-h-[520px] items-center justify-center">
      <div className="w-full">
        <AuthGate />
      </div>
    </div>
  );
}
