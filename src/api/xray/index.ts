import type {
  Client,
  ClientTraffic,
  HostSeries,
  Inbound,
  LogPage,
  LogQuery,
  Node,
  Overview,
  Page,
  RangeQuery,
  Session,
  StreamQuery,
} from './types';

export class ObserverError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterMs: number;
  readonly requestId: string;
  constructor(message: string, status: number, code: string, retryAfterMs = 3000, requestId = '') {
    super(message);
    this.name = 'ObserverError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
    this.requestId = requestId;
  }
}

export function retryDelay(value: string | null) {
  if (!value) return 3000;
  const seconds = Number(value);
  return Math.max(
    1000,
    Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now() || 3000,
  );
}

export async function responseError(response: Response) {
  const body = await response.json().catch(() => null);
  return new ObserverError(
    body?.error?.message || `请求失败（HTTP ${response.status}）`,
    response.status,
    body?.error?.code || 'http_error',
    retryDelay(response.headers.get('Retry-After')),
    body?.error?.request_id || response.headers.get('X-Request-ID') || '',
  );
}

export function createObserverApi(
  token: string,
  unauthorized: () => void,
  fetcher: typeof fetch = fetch,
) {
  let serverTime = Date.now();
  let receivedTime = Date.now();
  const headers = () => ({ Authorization: `Bearer ${token}`, Accept: 'application/json' });
  function url(path: string, query: object = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    return `/api/v1${path}${params.size ? `?${params}` : ''}`;
  }
  function observeTime(response: Response) {
    const value = Number(response.headers.get('X-Server-Time-Ms'));
    if (value > 0 && Number.isSafeInteger(value)) {
      serverTime = value;
      receivedTime = Date.now();
    }
  }
  async function get<T>(path: string, query: object = {}, signal?: AbortSignal): Promise<T> {
    const timeout = AbortSignal.timeout(15000);
    const response = await fetcher(url(path, query), {
      headers: headers(),
      credentials: 'omit',
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (signal?.aborted) {
      await response.body?.cancel();
      throw signal.reason;
    }
    observeTime(response);
    if (!response.ok) {
      const error = await responseError(response);
      if (signal?.aborted) throw signal.reason;
      if (error.status === 401) unauthorized();
      throw error;
    }
    const result = await response.json();
    if (signal?.aborted) throw signal.reason;
    return result as T;
  }
  const resource = (id: string) => encodeURIComponent(id);
  return {
    // 留出 1 秒，避免网络延迟/时钟估计导致 to_ms 晚于服务端校验时刻。
    now: () => serverTime + Date.now() - receivedTime - 1000,
    headers,
    url,
    observeTime,
    unauthorized,
    session: (signal?: AbortSignal) => get<Session>('/auth/session', {}, signal),
    nodes: (page = 1, signal?: AbortSignal) =>
      get<Page<Node>>('/nodes', { page, size: 200 }, signal),
    overview: (signal?: AbortSignal) => get<Overview>('/overview', {}, signal),
    host: (node_id: string, range: RangeQuery, signal?: AbortSignal) =>
      get<HostSeries>('/host/metrics', { node_id, ...range }, signal),
    inbounds: (node_id: string, page: number, signal?: AbortSignal, size = 20) =>
      get<Page<Inbound>>('/inbounds', { node_id, page, size }, signal),
    clients: (node_id: string, page: number, signal?: AbortSignal, size = 20) =>
      get<Page<Client>>('/clients', { node_id, page, size }, signal),
    traffic: (node_id: string, client_id: string, range: RangeQuery, signal?: AbortSignal) =>
      get<ClientTraffic>(`/clients/${resource(client_id)}/traffic`, { node_id, ...range }, signal),
    logs: (query: LogQuery, signal?: AbortSignal) => get<LogPage>('/logs', query, signal),
    streamUrl: (query: StreamQuery) => url('/stream', query),
  };
}
export type ObserverApi = ReturnType<typeof createObserverApi>;
