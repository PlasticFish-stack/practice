import { createParser } from 'eventsource-parser';
import { getCurrentScope, onScopeDispose, readonly, shallowRef } from 'vue';

export type SSEMessage = { data: string; event: string; id: string };
export type SSEStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';
export type SSEOptions = Omit<RequestInit, 'signal' | 'headers' | 'body'> & {
  headers?: HeadersInit | (() => HeadersInit);
  body?: BodyInit | null;
  /** 默认只对 GET 自动重连；POST 等请求需显式开启并保证可重复执行。 */
  retry?: boolean;
  reconnectInterval?: number;
  /** 每次 connect() 最多自动重连次数，默认 3。 */
  maxReconnectAttempts?: number;
  onMessage?: (message: SSEMessage) => void;
  onOpen?: (response: Response) => void;
  onError?: (error: Error) => void;
};

export class SSEError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.name = 'SSEError';
    this.status = status;
    this.retryable = retryable;
  }
}

export function useSSE(url: string, options: SSEOptions = {}) {
  const {
    headers: inputHeaders,
    retry,
    reconnectInterval = 3000,
    maxReconnectAttempts = 3,
    onMessage,
    onOpen,
    onError,
    ...request
  } = options;
  const canRetry = retry ?? (request.method ?? 'GET').toUpperCase() === 'GET';
  const status = shallowRef<SSEStatus>('idle');
  const error = shallowRef<Error | null>(null);
  const lastEvent = shallowRef<SSEMessage | null>(null);
  let controller: AbortController | null = null;
  let lastEventId = '';
  let retryDelay = reconnectInterval;

  async function consume(signal: AbortSignal): Promise<boolean> {
    const headers = new Headers(typeof inputHeaders === 'function' ? inputHeaders() : inputHeaders);
    headers.set('Accept', 'text/event-stream');
    // Cookie 会话的同源写请求带 CSRF 头，不向外部地址泄露令牌。
    const sameOrigin =
      typeof location !== 'undefined' && new URL(url, location.href).origin === location.origin;
    if (
      sameOrigin &&
      !['GET', 'HEAD', 'OPTIONS'].includes((request.method ?? 'GET').toUpperCase()) &&
      typeof document !== 'undefined' &&
      !headers.has('X-XSRF-TOKEN')
    ) {
      const csrf = document.cookie
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith('XSRF-TOKEN='))
        ?.slice(11);
      if (csrf) headers.set('X-XSRF-TOKEN', decodeURIComponent(csrf));
    }
    if (lastEventId) headers.set('Last-Event-ID', lastEventId);

    const response = await fetch(url, { ...request, headers, signal, cache: 'no-store' });
    if (signal.aborted) {
      await response.body?.cancel();
      return false;
    }
    if (response.status === 204) {
      await response.body?.cancel();
      return false;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new SSEError(
        `SSE 请求失败（HTTP ${response.status}）`,
        response.status,
        response.status >= 500 || response.status === 429 || response.status === 408,
      );
    }
    const contentType = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType !== 'text/event-stream' || !response.body) {
      await response.body?.cancel();
      throw new SSEError('接口未返回 text/event-stream', response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createParser({
      maxBufferSize: 1024 * 1024,
      onId: (id) => {
        if (!signal.aborted) lastEventId = id;
      },
      onRetry: (delay) => {
        if (!signal.aborted) retryDelay = delay;
      },
      onError: (cause) => {
        if (cause.type === 'max-buffer-size-exceeded') throw new SSEError(cause.message, 200);
      },
      onEvent: (event) => {
        if (signal.aborted) return;
        const message = { data: event.data, event: event.event ?? 'message', id: lastEventId };
        lastEvent.value = message;
        notify(onMessage, message);
      },
    });
    try {
      status.value = 'connected';
      error.value = null;
      notify(onOpen, response);
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (signal.aborted) break;
        if (done) {
          parser.feed(decoder.decode());
          return true;
        }
        parser.feed(decoder.decode(value, { stream: true }));
      }
      return false;
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  async function run(current: AbortController) {
    let attempts = 0;
    try {
      while (!current.signal.aborted) {
        status.value = 'connecting';
        try {
          if (!(await consume(current.signal))) break;
        } catch (cause) {
          if (current.signal.aborted) return;
          const failure = cause instanceof Error ? cause : new Error(String(cause));
          error.value = failure;
          notify(onError, failure);
          if (failure instanceof SSEError && !failure.retryable) break;
        }
        if (current.signal.aborted || !canRetry || attempts >= maxReconnectAttempts) break;
        status.value = 'reconnecting';
        await wait(Math.min(retryDelay * 2 ** attempts++, 30000), current.signal);
      }
    } finally {
      current.abort();
      if (controller === current) {
        controller = null;
        status.value = 'closed';
      }
    }
  }

  function connect() {
    if (controller) return;
    error.value = null;
    retryDelay = reconnectInterval;
    controller = new AbortController();
    void run(controller);
  }

  function close() {
    controller?.abort();
    controller = null;
    status.value = 'closed';
  }

  if (getCurrentScope()) onScopeDispose(close);
  return {
    connect,
    close,
    status: readonly(status),
    error: readonly(error),
    lastEvent: readonly(lastEvent),
  };
}

// 取消请求时也立即结束重连等待，移除定时器和 abort 监听。
function wait(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

function notify<T>(callback: ((value: T) => void) | undefined, value: T) {
  try {
    callback?.(value);
  } catch (cause) {
    console.error('SSE 回调执行失败', cause);
  }
}
