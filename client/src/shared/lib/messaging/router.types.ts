import type { ExtensionMessage, MessageResponse } from './contracts';

export type RouterHandler = (
  message: ExtensionMessage,
  sender: Browser.runtime.MessageSender,
) => Promise<MessageResponse<unknown>>;

export type RouterHandlers = Partial<
  Record<ExtensionMessage['type'], RouterHandler>
>;

export type MessageValidator = (value: unknown) => boolean;

export type MessageValidators = Partial<
  Record<ExtensionMessage['type'], MessageValidator>
>;
