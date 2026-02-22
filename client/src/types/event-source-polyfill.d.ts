declare module 'event-source-polyfill' {
  interface EventSourcePolyfillInit extends EventSourceInit {
    headers?: Record<string, string>;
    heartbeatTimeout?: number;
    lastEventIdQueryParameterName?: string;
  }

  export class EventSourcePolyfill extends EventSource {
    constructor(url: string, eventSourceInitDict?: EventSourcePolyfillInit);
  }

  export const NativeEventSource: typeof EventSource | undefined;
}

