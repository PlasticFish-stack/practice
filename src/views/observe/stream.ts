import { createParser } from 'eventsource-parser';
import { ObserverError, responseError, type ObserverApi } from '@/api/xray';
import type { LogRecord, StreamQuery } from '@/api/xray/types';

export type StreamState = 'connecting' | 'connected' | 'reconnecting' | 'paused' | 'closed';
export function startObserverStream(
  api: ObserverApi,
  query: StreamQuery,
  callbacks: {
    state: (state: StreamState) => void;
    logs: (items: LogRecord[]) => void;
    recover: () => void;
    error: (message: string) => void;
  },
) {
  const lifetime = new AbortController();
  let cursor = '';
  let retry = 3000;
  let failures = 0;
  async function run() {
    while (!lifetime.signal.aborted) {
      callbacks.state(failures ? 'reconnecting' : 'connecting');
      let delay = Math.min(retry * 2 ** Math.min(failures, 4), 30000);
      const connection = new AbortController();
      const signal = AbortSignal.any([lifetime.signal, connection.signal]);
      let idle: ReturnType<typeof setTimeout>;
      const touch = () => {
        clearTimeout(idle);
        idle = setTimeout(() => connection.abort(), 45000);
      };
      touch();
      try {
        const headers = new Headers(api.headers());
        headers.set('Accept', 'text/event-stream');
        if (cursor) headers.set('Last-Event-ID', cursor);
        const response = await fetch(api.streamUrl(query), {
          headers,
          credentials: 'omit',
          cache: 'no-store',
          signal,
        });
        api.observeTime(response);
        if (!response.ok) throw await responseError(response);
        if (
          !response.headers.get('Content-Type')?.includes('text/event-stream') ||
          !response.body
        ) {
          await response.body?.cancel();
          throw new ObserverError('实时接口未返回事件流', 200, 'invalid_stream');
        }
        callbacks.state('connected');
        callbacks.error('');
        callbacks.recover();
        failures = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let eventId = cursor;
        const parser = createParser({
          maxBufferSize: 1024 * 1024,
          onId: (id) => {
            eventId = id;
          },
          onRetry: (ms) => {
            retry = Math.max(1000, ms);
          },
          onError: (error) => {
            if (error.type === 'max-buffer-size-exceeded') throw error;
          },
          onEvent: (event) => {
            const body = JSON.parse(event.data);
            if (event.event === 'log') {
              if (!Array.isArray(body.items)) throw new Error('日志事件格式错误');
              callbacks.logs(body.items);
            }
            cursor = eventId;
          },
        });
        try {
          while (!signal.aborted) {
            const chunk = await reader.read();
            if (chunk.done) {
              parser.feed(decoder.decode());
              break;
            }
            touch();
            parser.feed(decoder.decode(chunk.value, { stream: true }));
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
      } catch (cause) {
        if (lifetime.signal.aborted) return;
        if (cause instanceof ObserverError) {
          if (cause.status === 401) {
            api.unauthorized();
            return;
          }
          if (cause.status === 409 || (cause.status === 400 && cursor)) {
            cursor = '';
            callbacks.error('游标已失效，正在重建流并补查最近日志');
            delay = 1000;
          } else if (cause.status === 429) {
            delay = Math.max(delay, cause.retryAfterMs);
            callbacks.error('实时连接限流，正在等待重试');
          } else if (cause.status < 500 && cause.status !== 408) {
            callbacks.error(cause.message);
            callbacks.state('closed');
            return;
          } else callbacks.error(cause.message);
        } else callbacks.error('实时连接中断，正在重连并补查最近日志');
      } finally {
        clearTimeout(idle!);
        connection.abort();
      }
      if (lifetime.signal.aborted) return;
      callbacks.state('reconnecting');
      failures++;
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          lifetime.signal.removeEventListener('abort', finish);
          resolve();
        };
        const timer = setTimeout(finish, delay);
        lifetime.signal.addEventListener('abort', finish, { once: true });
      });
    }
  }
  void run();
  return () => {
    lifetime.abort();
    callbacks.state('paused');
  };
}
