import { onScopeDispose, shallowRef } from 'vue';
import type { TerminalSize, TerminalStatus } from '@/components/AppTerminal/types';

export function terminalSocketUrl(value: string, base: string) {
  if (!value.trim()) throw new Error('请输入终端网关地址');
  const page = new URL(base);
  const url = new URL(value, page);
  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (
    !['ws:', 'wss:'].includes(url.protocol) ||
    url.host !== page.host ||
    url.username ||
    url.password ||
    url.hash ||
    (page.protocol === 'https:' && url.protocol !== 'wss:')
  )
    throw new Error('请使用同源终端网关地址，HTTPS 页面需要 WSS');
  return url.href;
}

/** A terminal is a live session: never queue input or silently reconnect/replay it. */
export function useTerminalConnection(
  output: (data: string | Uint8Array, parsed: () => void) => void,
) {
  const status = shallowRef<TerminalStatus>('disconnected');
  const error = shallowRef('');
  let socket: WebSocket | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  let pendingOutput = 0;
  let lastSize: TerminalSize = { cols: 80, rows: 24 };
  function release() {
    revision++;
    clearTimeout(timeout);
    const previous = socket;
    socket = undefined;
    previous?.close();
    pendingOutput = 0;
  }
  function disconnect() {
    release();
    status.value = 'disconnected';
    error.value = '';
  }
  function fail(message: string) {
    release();
    status.value = 'error';
    error.value = message;
  }
  function send(data: string | ArrayBuffer) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 256 * 1024) return fail('终端发送缓冲已满，请重新连接');
    try {
      socket.send(data);
    } catch {
      fail('终端数据发送失败，请重新连接');
    }
  }
  function resize(size: TerminalSize) {
    lastSize = size;
    if (status.value === 'connected') send(JSON.stringify({ type: 'resize', ...size }));
  }
  function input(data: string) {
    if (status.value === 'connected') send(JSON.stringify({ type: 'input', data }));
  }
  function binary(data: Uint8Array) {
    if (status.value === 'connected') send(new Uint8Array(data).buffer);
  }
  function connect(endpoint: string, size: TerminalSize) {
    disconnect();
    lastSize = size;
    let url: string;
    try {
      url = terminalSocketUrl(endpoint, window.location.href);
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : '网关地址无效');
      return;
    }
    status.value = 'connecting';
    let client: WebSocket;
    try {
      client = new WebSocket(url);
    } catch {
      fail('无法创建终端连接');
      return;
    }
    socket = client;
    client.binaryType = 'arraybuffer';
    const version = revision;
    const current = () => version === revision && socket === client;
    timeout = setTimeout(() => {
      if (current()) fail('终端连接超时，请检查后端网关');
    }, 10000);
    client.onopen = () => {
      if (current()) send(JSON.stringify({ type: 'resize', ...lastSize }));
    };
    function write(data: string | Uint8Array) {
      const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data).byteLength : data.byteLength;
      pendingOutput += bytes;
      if (pendingOutput > 1024 * 1024) return fail('终端输出过快，连接已暂停，请检查网关流控');
      output(data, () => {
        if (current()) pendingOutput -= bytes;
      });
    }
    client.onmessage = (event: MessageEvent<unknown>) => {
      if (!current()) return;
      if (event.data instanceof ArrayBuffer) return write(new Uint8Array(event.data));
      if (typeof event.data !== 'string' || event.data.length > 1024 * 1024)
        return fail('终端网关消息无效');
      try {
        const message: unknown = JSON.parse(event.data);
        if (!message || typeof message !== 'object' || !('type' in message)) throw new Error();
        if (message.type === 'ready') {
          clearTimeout(timeout);
          status.value = 'connected';
          send(JSON.stringify({ type: 'resize', ...lastSize }));
        } else if (
          message.type === 'output' &&
          'data' in message &&
          typeof message.data === 'string'
        ) {
          write(message.data);
        } else if (
          message.type === 'error' &&
          'message' in message &&
          typeof message.message === 'string'
        ) {
          fail(message.message.slice(0, 500));
        } else if (message.type === 'exit') {
          disconnect();
        } else throw new Error();
      } catch {
        fail('终端网关响应格式不正确');
      }
    };
    client.onerror = () => {
      if (current()) fail('终端连接失败，请检查网关和访问权限');
    };
    client.onclose = (event) => {
      if (!current()) return;
      clearTimeout(timeout);
      socket = undefined;
      pendingOutput = 0;
      const normal = event.code === 1000 && status.value === 'connected';
      status.value = normal ? 'disconnected' : 'error';
      error.value = normal ? '' : '终端连接已中断，请手动重新连接';
    };
  }
  onScopeDispose(disconnect);
  return { status, error, connect, disconnect, input, binary, resize };
}
