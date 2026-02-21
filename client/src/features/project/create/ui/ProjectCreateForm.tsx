import { useState, type FormEvent } from 'react';

import type { ProjectCreatePayload } from '../../../../entities/project/model/types';
import { Button } from '../../../../shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../shared/ui/card';
import { Input } from '../../../../shared/ui/input';
import { Label } from '../../../../shared/ui/label';

interface ProjectCreateFormProps {
  isSubmitting: boolean;
  error: string | null;
  onCreate: (payload: ProjectCreatePayload) => Promise<void>;
}

export function ProjectCreateForm({
  isSubmitting,
  error,
  onCreate,
}: ProjectCreateFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    try {
      await onCreate({
        name: trimmedName,
        description: description.trim(),
      });
      setName('');
      setDescription('');
    } catch {
      // Error message is handled by parent state.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>프로젝트 등록</CardTitle>
        <CardDescription>이름과 설명을 입력해 새 프로젝트를 추가합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="project-name">프로젝트 이름</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 로그인 개선"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-description">설명</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="간단한 설명(선택)"
              disabled={isSubmitting}
            />
          </div>

          {error ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {error}
            </p>
          ) : null}

          <Button className="w-full" type="submit" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? '등록 중...' : '프로젝트 등록'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
