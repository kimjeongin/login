import { type FormEvent, useEffect, useState } from 'react';

import {
  API_BASE_URL,
  ApiError,
  KEYCLOAK_AUTH_URL,
  createProject,
  getProjects,
  isAccessTokenExpired,
  loginWithWebAuthFlow,
  parseAccessTokenClaims,
} from './lib/api';
import { clearTokens, loadStoredTokens, saveTokens } from './lib/auth-storage';
import { Button } from './components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import type { AuthTokens, Project } from './lib/types';

type ViewState = 'loading' | 'login' | 'projects';

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function readUsernameFromToken(accessToken: string): string {
  const claims = parseAccessTokenClaims(accessToken);
  if (!claims) {
    return '';
  }

  if (typeof claims.preferred_username === 'string' && claims.preferred_username) {
    return claims.preferred_username;
  }

  if (typeof claims.sub === 'string' && claims.sub) {
    return claims.sub;
  }

  return '';
}

function App() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [currentUsername, setCurrentUsername] = useState('');

  const [loginError, setLoginError] = useState('');
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isProjectSubmitting, setIsProjectSubmitting] = useState(false);

  const loginHint = `Auth: ${KEYCLOAK_AUTH_URL}`;
  const apiHint = `Backend: ${API_BASE_URL}`;

  useEffect(() => {
    let unmounted = false;

    const bootstrap = async () => {
      const stored = loadStoredTokens();
      if (!stored) {
        if (!unmounted) {
          setViewState('login');
        }
        return;
      }

      if (isAccessTokenExpired(stored.access_token)) {
        clearTokens();
        if (!unmounted) {
          setLoginError('액세스 토큰이 만료되었습니다. 다시 로그인해주세요.');
          setViewState('login');
        }
        return;
      }

      if (!unmounted) {
        setTokens(stored);
        setCurrentUsername(readUsernameFromToken(stored.access_token));
      }

      try {
        const items = await getProjects(stored.access_token);
        if (!unmounted) {
          setProjects(items);
          setViewState('projects');
        }
      } catch (error) {
        clearTokens();
        if (!unmounted) {
          setTokens(null);
          setProjects([]);
          setCurrentUsername('');
          setViewState('login');
          setLoginError(readErrorMessage(error, '세션이 만료되었습니다. 다시 로그인해주세요.'));
        }
      }
    };

    void bootstrap();

    return () => {
      unmounted = true;
    };
  }, []);

  const resetToLogin = (message?: string) => {
    clearTokens();
    setTokens(null);
    setCurrentUsername('');
    setProjects([]);
    setProjectsError('');
    setViewState('login');
    if (message) {
      setLoginError(message);
    }
  };

  const logout = () => {
    resetToLogin();
    setLoginError('');
  };

  const loadProjectList = async (accessToken: string) => {
    setProjectsError('');
    setIsProjectsLoading(true);
    try {
      const items = await getProjects(accessToken);
      setProjects(items);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        resetToLogin('토큰이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.');
      } else {
        setProjectsError(readErrorMessage(error, '프로젝트 목록을 불러오지 못했습니다.'));
      }
    } finally {
      setIsProjectsLoading(false);
    }
  };

  const onClickLogin = async () => {
    setLoginError('');
    setIsLoginSubmitting(true);

    try {
      const nextTokens = await loginWithWebAuthFlow();
      saveTokens(nextTokens);
      setTokens(nextTokens);
      setCurrentUsername(readUsernameFromToken(nextTokens.access_token));

      const items = await getProjects(nextTokens.access_token);
      setProjects(items);
      setViewState('projects');
    } catch (error) {
      clearTokens();
      setTokens(null);
      setLoginError(readErrorMessage(error, '로그인에 실패했습니다.'));
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const onSubmitProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!tokens) {
      resetToLogin('로그인이 필요합니다.');
      return;
    }

    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      setProjectsError('프로젝트 이름은 필수입니다.');
      return;
    }

    setProjectsError('');
    setIsProjectSubmitting(true);
    try {
      const created = await createProject(tokens.access_token, {
        name: trimmedName,
        description: newProjectDescription.trim(),
      });
      setProjects((previous) => [created, ...previous]);
      setNewProjectName('');
      setNewProjectDescription('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        resetToLogin('토큰이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.');
      } else {
        setProjectsError(readErrorMessage(error, '프로젝트를 등록하지 못했습니다.'));
      }
    } finally {
      setIsProjectSubmitting(false);
    }
  };

  if (viewState === 'loading') {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center">
        <Card className="w-full">
          <CardContent className="pt-5 text-center text-sm text-slate-600">
            세션 확인 중...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === 'login') {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>로그인</CardTitle>
            <CardDescription>
              Keycloak 인증 창을 열어 로그인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loginError ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {loginError}
              </p>
            ) : null}

            <Button className="w-full" onClick={onClickLogin} disabled={isLoginSubmitting}>
              {isLoginSubmitting ? '인증 진행 중...' : 'Keycloak 로그인'}
            </Button>

            <p className="text-[11px] text-slate-500">{loginHint}</p>
            <p className="text-[11px] text-slate-500">{apiHint}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>프로젝트 관리</CardTitle>
              <CardDescription>
                로그인 사용자: <span className="font-medium">{currentUsername}</span>
              </CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={logout}>
              로그아웃
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>프로젝트 등록</CardTitle>
          <CardDescription>이름과 설명을 입력해 새 프로젝트를 추가합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmitProject}>
            <div className="space-y-1.5">
              <Label htmlFor="project-name">프로젝트 이름</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="예: 로그인 개선"
                disabled={isProjectSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-desc">설명</Label>
              <Input
                id="project-desc"
                value={newProjectDescription}
                onChange={(event) => setNewProjectDescription(event.target.value)}
                placeholder="간단한 설명(선택)"
                disabled={isProjectSubmitting}
              />
            </div>

            {projectsError ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {projectsError}
              </p>
            ) : null}

            <Button className="w-full" type="submit" disabled={isProjectSubmitting}>
              {isProjectSubmitting ? '등록 중...' : '프로젝트 등록'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>프로젝트 목록</CardTitle>
              <CardDescription>현재 계정으로 등록된 프로젝트</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => tokens && void loadProjectList(tokens.access_token)}
              disabled={isProjectsLoading || !tokens}
            >
              {isProjectsLoading ? '새로고침...' : '새로고침'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              등록된 프로젝트가 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-900">{project.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{project.description || '설명 없음'}</p>
                  <p className="mt-2 text-[11px] text-slate-400">{formatDate(project.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
