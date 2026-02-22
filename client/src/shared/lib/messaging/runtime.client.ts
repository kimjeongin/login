import type {
  AppErrorCode,
  MessageByType,
  MessageResponse,
  MessageResultMap,
} from './contracts';

export class MessagingClientError extends Error {
  code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export async function sendMessage<T extends keyof MessageResultMap>(
  message: MessageByType<T>,
): Promise<MessageResultMap[T]> {
  let response: MessageResponse<MessageResultMap[T]> | undefined;

  try {
    response = (await browser.runtime.sendMessage(message)) as
      | MessageResponse<MessageResultMap[T]>
      | undefined;
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Background is unavailable.';
    throw new MessagingClientError('NETWORK', messageText);
  }

  if (!response) {
    throw new MessagingClientError('NETWORK', 'No response from background worker.');
  }

  if (!response.ok) {
    throw new MessagingClientError(response.error.code, response.error.message);
  }

  return response.data;
}
