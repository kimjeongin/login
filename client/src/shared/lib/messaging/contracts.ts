import type {
  AuthMessage,
  AuthMessageResultMap,
} from '../../../domains/auth/messaging/auth.contracts';
import type {
  ProjectMessage,
  ProjectMessageResultMap,
} from '../../../domains/projects/messaging/project.contracts';

export * from './base-contracts';
export * from '../../../domains/auth/messaging/auth.contracts';
export * from '../../../domains/projects/messaging/project.contracts';

export type ExtensionMessage = AuthMessage | ProjectMessage;

export type MessageResultMap = AuthMessageResultMap & ProjectMessageResultMap;

export type MessageByType<T extends keyof MessageResultMap> = Extract<
  ExtensionMessage,
  { type: T }
>;
