export type BrowserControlAction = 'click' | 'popup' | 'close';

export interface BrowserControlSendActionPayload {
  action: BrowserControlAction;
}

export interface BrowserControlSendActionResponse {
  ok: boolean;
  action: BrowserControlAction;
  dispatched_at: string;
}

export interface BrowserControlSseTokenResponse {
  accessToken: string;
}

export interface BrowserControlSseEvent {
  event_id: string;
  action: BrowserControlAction;
  actor: string | null;
  created_at: string;
}

