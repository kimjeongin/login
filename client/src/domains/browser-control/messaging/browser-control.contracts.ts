import type {
  BrowserControlSendActionPayload,
  BrowserControlSendActionResponse,
  BrowserControlSseTokenResponse,
} from '../../../entities/browser-control/model/types';

export type BrowserControlMessage =
  | { type: 'BROWSER_CONTROL_GET_SSE_TOKEN' }
  | {
      type: 'BROWSER_CONTROL_SEND_ACTION';
      payload: BrowserControlSendActionPayload;
    };

export interface BrowserControlMessageResultMap {
  BROWSER_CONTROL_GET_SSE_TOKEN: BrowserControlSseTokenResponse;
  BROWSER_CONTROL_SEND_ACTION: BrowserControlSendActionResponse;
}

