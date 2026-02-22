import type {
  AuthMessage,
  AuthMessageResultMap,
} from '../../../domains/auth/messaging/auth.contracts';
import type {
  BrowserControlMessage,
  BrowserControlMessageResultMap,
} from '../../../domains/browser-control/messaging/browser-control.contracts';
import type {
  ChatMessage,
  ChatMessageResultMap,
} from '../../../domains/chat/messaging/chat.contracts';
import type {
  ProjectMessage,
  ProjectMessageResultMap,
} from '../../../domains/projects/messaging/project.contracts';

export * from './base-contracts';
export * from '../../../domains/auth/messaging/auth.contracts';
export * from '../../../domains/browser-control/messaging/browser-control.contracts';
export * from '../../../domains/chat/messaging/chat.contracts';
export * from '../../../domains/projects/messaging/project.contracts';

export type ExtensionMessage = AuthMessage |
  BrowserControlMessage |
  ChatMessage |
  ProjectMessage;

export type MessageResultMap = AuthMessageResultMap &
  BrowserControlMessageResultMap &
  ChatMessageResultMap &
  ProjectMessageResultMap;

export type MessageByType<T extends keyof MessageResultMap> = Extract<
  ExtensionMessage,
  { type: T }
>;
