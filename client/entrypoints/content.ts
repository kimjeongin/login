import type { SessionView } from '@/src/entities/auth/model/types';
import type { Project } from '@/src/entities/project/model/types';
import {
  MessagingClientError,
  requestAuthLogin,
  requestAuthLogout,
  requestAuthSession,
  requestProjectCreate,
  requestProjectList,
} from '@/src/shared/lib/messaging/client';

const WIDGET_HOST_ID = 'project-content-widget-host';

type ViewMode = 'loading' | 'login' | 'ready' | 'forbidden' | 'error';

type WidgetState = {
  mode: ViewMode;
  session: SessionView;
  projects: Project[];
  isWorking: boolean;
  error: string | null;
  draftName: string;
};

const loggedOutSession: SessionView = {
  isAuthenticated: false,
  user: null,
  expiresAt: null,
};

const widgetStyle = `
:host {
  all: initial;
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647;
}

* {
  box-sizing: border-box;
}

.panel {
  width: min(360px, calc(100vw - 24px));
  max-height: min(72vh, 580px);
  border-radius: 12px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 16px 30px rgba(2, 6, 23, 0.16);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow: hidden;
}

.section {
  padding: 12px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}

.subtitle {
  margin-top: 2px;
  color: #475569;
  font-size: 12px;
}

.stack {
  display: grid;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: #0f172a;
  background: #fff;
}

.input:focus {
  border-color: #0f172a;
  outline: none;
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.12);
}

.button {
  border: none;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-primary {
  background: #0f172a;
  color: #fff;
}

.button-secondary {
  background: #e2e8f0;
  color: #0f172a;
}

.button-ghost {
  background: transparent;
  color: #334155;
  border: 1px solid #cbd5e1;
}

.message {
  border-radius: 8px;
  border: 1px solid #fcd34d;
  background: #fffbeb;
  color: #92400e;
  padding: 8px 10px;
  font-size: 12px;
}

.list {
  max-height: 280px;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px;
  background: #f8fafc;
}

.item-name {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}

.item-meta {
  margin-top: 4px;
  font-size: 11px;
  color: #64748b;
}

.muted {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}
`;

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof MessagingClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
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

function createButton(
  label: string,
  onClick: () => void,
  className: string,
  disabled = false,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button ${className}`;
  button.disabled = disabled;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

class ProjectContentWidget {
  private readonly root: HTMLElement;

  private readonly state: WidgetState = {
    mode: 'loading',
    session: loggedOutSession,
    projects: [],
    isWorking: false,
    error: null,
    draftName: '',
  };

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async bootstrap(): Promise<void> {
    this.state.mode = 'loading';
    this.state.error = null;
    this.render();

    try {
      const session = await requestAuthSession();
      this.state.session = session;
      if (!session.isAuthenticated) {
        this.state.mode = 'login';
        this.render();
        return;
      }

      await this.loadProjects();
    } catch (error) {
      if (error instanceof MessagingClientError && error.code === 'AUTH_REQUIRED') {
        this.state.session = loggedOutSession;
        this.state.mode = 'login';
        this.state.error = null;
        this.render();
        return;
      }

      this.state.mode = 'error';
      this.state.error = toMessage(error, '세션 상태를 확인하지 못했습니다.');
      this.render();
    }
  }

  private async loadProjects(): Promise<void> {
    this.state.isWorking = true;
    this.state.error = null;
    this.render();

    try {
      const items = await requestProjectList();
      this.state.projects = items;
      this.state.mode = 'ready';
    } catch (error) {
      this.applyProjectError(error, '프로젝트 목록을 불러오지 못했습니다.');
    } finally {
      this.state.isWorking = false;
      this.render();
    }
  }

  private applyProjectError(error: unknown, fallback: string): void {
    if (error instanceof MessagingClientError && error.code === 'AUTH_REQUIRED') {
      this.state.session = loggedOutSession;
      this.state.projects = [];
      this.state.mode = 'login';
      this.state.error = null;
      return;
    }

    if (error instanceof MessagingClientError && error.code === 'FORBIDDEN') {
      this.state.mode = 'forbidden';
      this.state.error = error.message;
      return;
    }

    this.state.mode = 'error';
    this.state.error = toMessage(error, fallback);
  }

  private async onLogin(): Promise<void> {
    this.state.isWorking = true;
    this.state.error = null;
    this.render();

    try {
      const session = await requestAuthLogin();
      this.state.session = session;
    } catch (error) {
      this.state.mode = 'login';
      this.state.error = toMessage(error, '로그인에 실패했습니다.');
      this.state.isWorking = false;
      this.render();
      return;
    }

    this.state.isWorking = false;
    await this.loadProjects();
  }

  private async onLogout(): Promise<void> {
    this.state.isWorking = true;
    this.render();

    try {
      await requestAuthLogout();
      this.state.session = loggedOutSession;
      this.state.projects = [];
      this.state.error = null;
      this.state.mode = 'login';
    } catch (error) {
      this.state.error = toMessage(error, '로그아웃에 실패했습니다.');
    } finally {
      this.state.isWorking = false;
      this.render();
    }
  }

  private async onAddProject(): Promise<void> {
    const name = this.state.draftName.trim();
    if (!name) {
      return;
    }

    this.state.isWorking = true;
    this.state.error = null;
    this.render();

    try {
      const created = await requestProjectCreate({ name });
      this.state.projects = [created, ...this.state.projects];
      this.state.draftName = '';
      this.state.mode = 'ready';
    } catch (error) {
      this.applyProjectError(error, '프로젝트를 추가하지 못했습니다.');
    } finally {
      this.state.isWorking = false;
      this.render();
    }
  }

  private renderBasePanel(title: string, subtitle: string): HTMLElement {
    const panel = document.createElement('section');
    panel.className = 'panel';

    const header = document.createElement('header');
    header.className = 'section header';

    const headingBox = document.createElement('div');
    const heading = document.createElement('h2');
    heading.className = 'title';
    heading.textContent = title;
    const hint = document.createElement('p');
    hint.className = 'subtitle';
    hint.textContent = subtitle;
    headingBox.append(heading, hint);

    header.appendChild(headingBox);
    panel.appendChild(header);
    return panel;
  }

  private renderMessage(target: HTMLElement): void {
    if (!this.state.error) {
      return;
    }

    const message = document.createElement('p');
    message.className = 'message';
    message.textContent = this.state.error;
    target.appendChild(message);
  }

  private renderLoginView(): HTMLElement {
    const panel = this.renderBasePanel('프로젝트 패널', '로그인이 필요합니다.');
    const body = document.createElement('div');
    body.className = 'section stack';

    this.renderMessage(body);
    body.append(
      createButton(
        this.state.isWorking ? '인증 진행 중...' : '로그인',
        () => {
          void this.onLogin();
        },
        'button-primary',
        this.state.isWorking,
      ),
    );

    panel.appendChild(body);
    return panel;
  }

  private renderForbiddenView(): HTMLElement {
    const panel = this.renderBasePanel(
      '프로젝트 패널',
      '권한이 있는 사용자만 접근할 수 있습니다.',
    );
    const body = document.createElement('div');
    body.className = 'section stack';
    this.renderMessage(body);

    body.append(
      createButton(
        this.state.isWorking ? '확인 중...' : '권한 다시 확인',
        () => {
          void this.loadProjects();
        },
        'button-secondary',
        this.state.isWorking,
      ),
      createButton(
        this.state.isWorking ? '처리 중...' : '로그아웃',
        () => {
          void this.onLogout();
        },
        'button-ghost',
        this.state.isWorking,
      ),
    );

    panel.appendChild(body);
    return panel;
  }

  private renderErrorView(): HTMLElement {
    const panel = this.renderBasePanel('프로젝트 패널', '연결 상태를 확인해 주세요.');
    const body = document.createElement('div');
    body.className = 'section stack';
    this.renderMessage(body);
    body.append(
      createButton(
        this.state.isWorking ? '재시도 중...' : '다시 시도',
        () => {
          void this.bootstrap();
        },
        'button-secondary',
        this.state.isWorking,
      ),
    );

    panel.appendChild(body);
    return panel;
  }

  private renderLoadingView(): HTMLElement {
    const panel = this.renderBasePanel('프로젝트 패널', '세션 상태를 확인하는 중입니다.');
    const body = document.createElement('div');
    body.className = 'section';
    const text = document.createElement('p');
    text.className = 'muted';
    text.textContent = '불러오는 중...';
    body.appendChild(text);
    panel.appendChild(body);
    return panel;
  }

  private renderReadyView(): HTMLElement {
    const panel = this.renderBasePanel(
      '프로젝트 패널',
      `사용자: ${this.state.session.user?.username ?? '-'}`,
    );
    const headerActions = document.createElement('div');
    headerActions.className = 'row';
    headerActions.append(
      createButton(
        this.state.isWorking ? '갱신 중...' : '새로고침',
        () => {
          void this.loadProjects();
        },
        'button-ghost',
        this.state.isWorking,
      ),
      createButton(
        this.state.isWorking ? '처리 중...' : '로그아웃',
        () => {
          void this.onLogout();
        },
        'button-secondary',
        this.state.isWorking,
      ),
    );

    panel.querySelector('.header')?.appendChild(headerActions);

    const body = document.createElement('div');
    body.className = 'section stack';

    const form = document.createElement('form');
    form.className = 'row';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.onAddProject();
    });

    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'text';
    input.value = this.state.draftName;
    input.placeholder = '프로젝트 이름';
    input.disabled = this.state.isWorking;
    input.addEventListener('input', () => {
      this.state.draftName = input.value;
    });

    form.append(
      input,
      createButton(
        this.state.isWorking ? '추가 중...' : '추가',
        () => {
          void this.onAddProject();
        },
        'button-primary',
        this.state.isWorking,
      ),
    );

    body.append(form);
    this.renderMessage(body);

    if (this.state.projects.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = '등록된 프로젝트가 없습니다.';
      body.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'list';

      this.state.projects.forEach((project) => {
        const item = document.createElement('li');
        item.className = 'item';

        const name = document.createElement('p');
        name.className = 'item-name';
        name.textContent = project.name;

        const description = document.createElement('p');
        description.className = 'item-meta';
        description.textContent = project.description?.trim() || '설명 없음';

        const createdAt = document.createElement('p');
        createdAt.className = 'item-meta';
        createdAt.textContent = formatDate(project.created_at);

        item.append(name, description, createdAt);
        list.appendChild(item);
      });

      body.appendChild(list);
    }

    panel.appendChild(body);
    return panel;
  }

  render(): void {
    this.root.replaceChildren();

    const panel = (() => {
      switch (this.state.mode) {
        case 'login':
          return this.renderLoginView();
        case 'ready':
          return this.renderReadyView();
        case 'forbidden':
          return this.renderForbiddenView();
        case 'error':
          return this.renderErrorView();
        case 'loading':
        default:
          return this.renderLoadingView();
      }
    })();

    this.root.appendChild(panel);
  }
}

function mountWidget(): void {
  if (document.getElementById(WIDGET_HOST_ID)) {
    return;
  }

  const host = document.createElement('div');
  host.id = WIDGET_HOST_ID;
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = widgetStyle;

  const appRoot = document.createElement('div');
  shadow.append(style, appRoot);

  const widget = new ProjectContentWidget(appRoot);
  void widget.bootstrap();
}

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    mountWidget();
  },
});
