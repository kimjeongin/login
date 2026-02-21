import { Button } from '../../../../shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../shared/ui/card';

interface LoginCardProps {
  isLoading: boolean;
  error: string | null;
  authHint: string;
  apiHint: string;
  onLogin: () => Promise<void>;
  onClearError: () => void;
}

export function LoginCard({
  isLoading,
  error,
  authHint,
  apiHint,
  onLogin,
  onClearError,
}: LoginCardProps) {
  const onClick = async () => {
    onClearError();
    await onLogin();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>로그인</CardTitle>
        <CardDescription>Keycloak 인증 창을 열어 로그인합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <Button className="w-full" onClick={() => void onClick()} disabled={isLoading}>
          {isLoading ? '인증 진행 중...' : 'Keycloak 로그인'}
        </Button>

        <p className="text-[11px] text-slate-500">{authHint}</p>
        <p className="text-[11px] text-slate-500">{apiHint}</p>
      </CardContent>
    </Card>
  );
}
