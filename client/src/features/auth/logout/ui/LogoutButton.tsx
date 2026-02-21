import { Button } from '../../../../shared/ui/button';

interface LogoutButtonProps {
  isLoading: boolean;
  onLogout: () => Promise<void>;
}

export function LogoutButton({ isLoading, onLogout }: LogoutButtonProps) {
  return (
    <Button variant="secondary" size="sm" disabled={isLoading} onClick={() => void onLogout()}>
      {isLoading ? '처리 중...' : '로그아웃'}
    </Button>
  );
}
