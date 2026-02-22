import { useCallback, useEffect, useState } from 'react';

import type {
  Project,
  ProjectCreatePayload,
} from '../../../entities/project/model/types';
import {
  MessagingClientError,
  requestProjectCreate,
  requestProjectList,
} from '../../../shared/lib/messaging/client';
import {
  Card,
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../shared/ui/card';
import { useAuth } from '../../../app/providers/AuthProvider';
import { LogoutButton } from '../../../features/auth/logout/ui/LogoutButton';
import { ProjectCreateForm } from '../../../features/project/create/ui/ProjectCreateForm';
import { ProjectList } from '../../../features/project/list/ui/ProjectList';
import { Button } from '../../../shared/ui/button';
import { BrowserControlPanel } from '../../browser-control-panel/ui/BrowserControlPanel';
import { ChatPanel } from '../../chat-panel/ui/ChatPanel';

type WorkspaceTab = 'projects' | 'chat' | 'browser-control';

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof MessagingClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function ProjectDashboard() {
  const { session, logout, refreshSession, isWorking } = useAuth();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [isProjectSubmitting, setIsProjectSubmitting] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const handleAuthError = useCallback(
    async (error: unknown, fallback: string) => {
      if (error instanceof MessagingClientError && error.code === 'AUTH_REQUIRED') {
        await refreshSession();
        return;
      }

      setProjectsError(toMessage(error, fallback));
    },
    [refreshSession],
  );

  const loadProjects = useCallback(async () => {
    setProjectsError(null);
    setIsProjectsLoading(true);

    try {
      const items = await requestProjectList();
      setProjects(items);
    } catch (error) {
      await handleAuthError(error, '프로젝트 목록을 불러오지 못했습니다.');
    } finally {
      setIsProjectsLoading(false);
    }
  }, [handleAuthError]);

  const createNewProject = useCallback(
    async (payload: ProjectCreatePayload) => {
      setProjectsError(null);
      setIsProjectSubmitting(true);

      try {
        const created = await requestProjectCreate(payload);
        setProjects((previous) => [created, ...previous]);
      } catch (error) {
        await handleAuthError(error, '프로젝트를 등록하지 못했습니다.');
        throw error;
      } finally {
        setIsProjectSubmitting(false);
      }
    },
    [handleAuthError],
  );

  useEffect(() => {
    if (!session.isAuthenticated) {
      setProjects([]);
      return;
    }

    void loadProjects();
  }, [session.isAuthenticated, loadProjects]);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>프로젝트 관리</CardTitle>
              <CardDescription>
                로그인 사용자: <span className="font-medium">{session.user?.username}</span>
              </CardDescription>
            </div>
            <LogoutButton isLoading={isWorking} onLogout={logout} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-3 gap-2 pt-4">
          <Button
            variant={activeTab === 'projects' ? 'default' : 'secondary'}
            onClick={() => setActiveTab('projects')}
            size="sm"
          >
            프로젝트
          </Button>
          <Button
            variant={activeTab === 'chat' ? 'default' : 'secondary'}
            onClick={() => setActiveTab('chat')}
            size="sm"
          >
            채팅
          </Button>
          <Button
            variant={activeTab === 'browser-control' ? 'default' : 'secondary'}
            onClick={() => setActiveTab('browser-control')}
            size="sm"
          >
            브라우저 제어
          </Button>
        </CardContent>
      </Card>

      {activeTab === 'projects' ? (
        <>
          <ProjectCreateForm
            isSubmitting={isProjectSubmitting}
            error={projectsError}
            onCreate={createNewProject}
          />
          <ProjectList
            projects={projects}
            isLoading={isProjectsLoading}
            error={projectsError}
            onRefresh={loadProjects}
          />
        </>
      ) : activeTab === 'chat' ? (
        <ChatPanel onAuthRequired={refreshSession} />
      ) : (
        <BrowserControlPanel onAuthRequired={refreshSession} />
      )}
    </div>
  );
}
