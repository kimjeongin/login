import type { Project } from '../../../../entities/project/model/types';
import { Button } from '../../../../shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../shared/ui/card';

interface ProjectListProps {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
}

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

export function ProjectList({ projects, isLoading, error, onRefresh }: ProjectListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>프로젝트 목록</CardTitle>
            <CardDescription>현재 계정으로 등록된 프로젝트</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void onRefresh()} disabled={isLoading}>
            {isLoading ? '새로고침...' : '새로고침'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {error}
          </p>
        ) : null}

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
  );
}
