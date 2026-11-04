const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { effectScope } = require('vue')
const { createServer } = require('node:http')
const { once } = require('node:events')

const source = ts.transpileModule(fs.readFileSync('src/composables/useSSE.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const encode = text => new TextEncoder().encode(text)
function stream(text, keepOpen = false) {
  return new Response(new ReadableStream({
    start(controller) {
      // 每个 UTF-8 字节单独一块，覆盖字符和 CRLF 被拆开的情况。
      for (const byte of encode(text)) controller.enqueue(new Uint8Array([byte]))
      if (!keepOpen) controller.close()
    },
  }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } })
}
function setup(fetchImpl = fetch, globals = {}) {
  const storage = new Map()
  const context = {
    exports: {}, require, Error, Headers, TextDecoder, AbortController, URL,
    ...globals,
    setTimeout, clearTimeout, fetch: fetchImpl,
    console: { error() {} },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      removeItem: key => storage.delete(key),
    },
  }
  vm.runInNewContext(source, context)
  return { ...context.exports, storage }
}
async function until(predicate) {
  const deadline = Date.now() + 2000
  while (!predicate()) {
    if (Date.now() > deadline) throw Error('Timed out waiting for SSE state')
    await new Promise(resolve => setTimeout(resolve, 2))
  }
}

test('UTF-8/CRLF, comments, multiline data, named events and incomplete EOF', async () => {
  const events = []
  const { useSSE } = setup(async () => stream('\uFEFF: ping\r\nid: 7\r\nevent: device\r\ndata: 中文\r\ndata: 第二行\r\n\r\ndata: next\n\ndata: incomplete'))
  const api = useSSE('/events', { retry: false, onMessage: event => events.push(event) })
  assert.equal(api.status.value, 'idle')
  api.connect()
  await until(() => api.status.value === 'closed')
  assert.equal(events.length, 2)
  assert.equal(events[0].data, '中文\n第二行')
  assert.equal(events[0].event, 'device')
  assert.equal(events[1].event, 'message')
  assert.equal(events[1].id, '7')
  assert.equal(api.lastEvent.value.data, 'next')
})

test('reconnect carries ID-only blocks and fresh token, honors retry, resets parser', async () => {
  const requests = [], events = []
  let token = 'old'
  const { useSSE } = setup(async (url, init) => {
    requests.push(init)
    if (requests.length === 1) {
      token = 'new'
      return stream('retry: 0\nid: resume-1\n\ndata: partial')
    }
    return stream('data: resumed\n\n')
  })

  const api = useSSE('/events', {
    headers: () => ({ Authorization: `Bearer ${token}` }),
    reconnectInterval: 60000, maxReconnectAttempts: 1, onMessage: event => events.push(event),
  })
  api.connect(); api.connect()
  await until(() => api.status.value === 'closed')
  assert.equal(requests.length, 2)
  assert.equal(requests[0].headers.get('Authorization'), 'Bearer old')
  assert.equal(requests[1].headers.get('Authorization'), 'Bearer new')
  assert.equal(requests[1].headers.get('Last-Event-ID'), 'resume-1')
  assert.equal(events.length, 1)
  assert.equal(events[0].data, 'resumed')
})

test('empty ID removes Last-Event-ID on the next retry', async () => {
  const requests = []
  const { useSSE } = setup(async (url, init) => {
    requests.push(init)
    return stream(requests.length === 1 ? 'id: old\n\nretry: 0\n\n' : 'id:\n\n')
  })
  const api = useSSE('/events', { maxReconnectAttempts: 2 })
  api.connect(); await until(() => api.status.value === 'closed')
  assert.equal(requests[1].headers.get('Last-Event-ID'), 'old')
  assert.equal(requests[2].headers.has('Last-Event-ID'), false)
})

test('fatal HTTP and content-type errors stop; 204 is a normal stop', async () => {
  for (const status of [401, 403, 404, 204, 200]) {
    let calls = 0, cancelled = 0
    const { useSSE, storage } = setup(async () => {
      calls++
      if (status === 204) return new Response(null, { status })
      return new Response(new ReadableStream({ cancel() { cancelled++ } }), {
        status, headers: { 'Content-Type': 'application/json' },
      })
    })
    storage.set('token', 'abc')
    const api = useSSE('/events', { reconnectInterval: 0 })
    api.connect(); await until(() => api.status.value === 'closed')
    assert.equal(calls, 1)
    assert.equal(api.error.value?.status, status === 204 ? undefined : status)
    assert.equal(cancelled, status === 204 ? 0 : 1)
    if (status === 401) assert.equal(api.error.value.status, 401)
  }
})

test('network/5xx failures have a bounded retry budget', async () => {
  for (const failure of ['network', 'server']) {
    let calls = 0, errors = 0
    const { useSSE } = setup(async () => {
      calls++
      if (failure === 'network') throw new TypeError('offline')
      return new Response('', { status: 503 })
    })
    const api = useSSE('/events', { reconnectInterval: 0, maxReconnectAttempts: 2, onError() { errors++ } })
    api.connect(); await until(() => api.status.value === 'closed')
    assert.equal(calls, 3)
    assert.equal(errors, 3)
  }
})

test('POST sends body/headers and does not replay on EOF or network error by default', async () => {
  for (const fail of [false, true]) {
    let calls = 0
    const { useSSE, storage } = setup(async (url, init) => {
      calls++
      assert.equal(init.method, 'POST')
      assert.equal(init.body, '{"prompt":"hi"}')
      assert.equal(init.headers.get('Authorization'), 'Basic explicit')
      if (fail) throw Error('offline')
      return stream('data: result\n\n')
    })
    storage.set('token', 'stored')
    const api = useSSE('/chat', {
      method: 'POST', body: '{"prompt":"hi"}',
      headers: () => ({ Authorization: 'Basic explicit', 'Content-Type': 'application/json' }),
      reconnectInterval: 0,
    })
    api.connect(); await until(() => api.status.value === 'closed')
    assert.equal(calls, 1)
  }
})

test('close cancels backoff and effectScope.stop cancels pending request', async () => {
  let calls = 0, signal
  const { useSSE } = setup(async (url, init) => {
    calls++; signal = init.signal
    throw Error('offline')
  })
  const api = useSSE('/events', { reconnectInterval: 30 })
  api.connect(); await until(() => api.status.value === 'reconnecting')
  api.close()
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(calls, 1)
  assert.equal(signal.aborted, true)

  const pending = setup((url, init) => new Promise((resolve, reject) => {
    signal = init.signal
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  }))
  const scope = effectScope()
  const scoped = scope.run(() => pending.useSSE('/events'))
  scoped.connect(); scope.stop()
  assert.equal(signal.aborted, true)
  assert.equal(scoped.status.value, 'closed')
  assert.equal(scoped.error.value, null)
})

test('stale responses and callbacks cannot affect a replacement connection', async () => {
  let resolveOld, calls = 0, cancelled = 0
  const { useSSE } = setup(async () => {
    calls++
    if (calls === 1) return new Promise(resolve => { resolveOld = resolve })
    return stream('data: new\n\n', true)
  })
  const api = useSSE('/events', { retry: false })
  api.connect(); api.close(); api.connect()
  await until(() => api.lastEvent.value?.data === 'new')
  resolveOld(new Response(new ReadableStream({ cancel() { cancelled++ } })))
  await until(() => cancelled === 1)
  assert.equal(api.status.value, 'connected')
  assert.equal(api.lastEvent.value.data, 'new')
  api.close()
})

test('callback failures do not duplicate requests; closing in callback ignores remaining events', async () => {
  let calls = 0, received = 0
  const { useSSE } = setup(async () => { calls++; return stream('data: first\n\ndata: second\n\n') })
  const api = useSSE('/events', { retry: false, onMessage() { received++; throw Error('business failure') } })
  api.connect(); await until(() => api.status.value === 'closed')
  assert.equal(calls, 1); assert.equal(received, 2)
  const second = useSSE('/events', { onMessage() { received++; second.close() } })
  second.connect(); await until(() => second.status.value === 'closed')
  assert.equal(received, 3)
})

test('real HTTP stream delivers before EOF, resumes by ID, and stops on 204', async () => {
  const requests = []
  const errors = []
  const server = createServer((req, res) => {
    requests.push(req.headers)
    if (requests.length > 1) { res.writeHead(204); res.end(); return }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    res.write('id: live-1\nretry: 0\nevent: device\ndata: ')
    const bytes = encode('在线\n\n')
    res.write(bytes.subarray(0, 1))
    setTimeout(() => { res.write(bytes.subarray(1)); }, 5)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { useSSE } = setup()
  let api
  try {
    api = useSSE(`http://127.0.0.1:${server.address().port}/events`, {
      onError(error) { errors.push(error) },
    })
    api.connect()
    await until(() => api.lastEvent.value?.data === '在线')
    assert.equal(api.status.value, 'connected')
    // 模拟服务器结束长连接，客户端应携带 ID 恢复。
    server.closeAllConnections()
    await until(() => requests.length === 2 && api.status.value === 'closed')
    assert.equal(requests[1]['last-event-id'], 'live-1')
    assert.equal(requests[0].accept, 'text/event-stream')
    assert.equal(errors.length, 1)
  } finally {
    api?.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})

test('POST SSE sends CSRF only to same-origin endpoints', async () => {
  for (const [url, expected] of [['/events', 'csrf-value'], ['https://external.test/events', null]]) {
    let sent
    const { useSSE } = setup(async (url, init) => { sent = init.headers; return stream('') }, {
      location: { href: 'https://app.test/', origin: 'https://app.test' },
      document: { cookie: 'XSRF-TOKEN=csrf-value' },
    })
    const api = useSSE(url, { method: 'POST' })
    api.connect(); await until(() => api.status.value === 'closed')
    assert.equal(sent.get('X-XSRF-TOKEN'), expected)
  }
})
