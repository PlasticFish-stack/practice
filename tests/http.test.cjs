const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

function load(path, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, require, console, ...globals };
  vm.runInNewContext(source, context, { filename: path });
  return context.exports;
}

function setup(adapter) {
  const storage = new Map();
  const module = load('src/net/axios/index.ts', {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      removeItem: (key) => storage.delete(key),
    },
  });
  return {
    ...module,
    api: module.default(
      { adapter },
      {
        getToken: () => storage.get('token') ?? null,
        onUnauthorized: () => storage.delete('token'),
      },
    ),
    storage,
  };
}

function response(config, data) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}

test('GET unwraps business data, keeps origin, and attaches token', async () => {
  let request;
  const payload = { list: [], total: 0 };
  const { api, storage } = setup(async (config) => {
    request = config;
    return response(config, { code: 200, message: 'ok', data: payload });
  });
  storage.set('token', 'abc');
  const result = await api.get('/api/devices', { page: 2 });
  assert.equal(result.data, payload);
  assert.equal(result.origin.data.data, payload);
  assert.equal(request.headers.get('Authorization'), 'Bearer abc');
  assert.equal(request.params.page, 2);
  assert.equal(request.timeout, 10000);
});

test('methods forward body/config and explicit authorization', async () => {
  const requests = [];
  const { api, storage } = setup(async (config) => {
    requests.push(config);
    return response(config, { code: 200, message: 'ok', data: null });
  });
  storage.set('token', 'Bearer stored');
  await api.post(
    '/items',
    { name: 'lamp' },
    { timeout: 50, headers: { Authorization: 'Basic custom' } },
  );
  await api.put('/items/1', { name: 'updated' }, { params: { version: 2 } });
  await api.delete('/items/1', { force: true });
  assert.equal(requests[0].method, 'post');
  assert.equal(requests[0].data, JSON.stringify({ name: 'lamp' }));
  assert.equal(requests[0].headers.get('Authorization'), 'Basic custom');
  assert.equal(requests[0].timeout, 50);
  assert.equal(requests[1].method, 'put');
  assert.equal(requests[1].params.version, 2);
  assert.equal(requests[2].method, 'delete');
  assert.equal(requests[2].params.force, true);
});

test('business rejection keeps code and clears expired token', async () => {
  const { api, storage, ApiError } = setup(async (config) =>
    response(config, { code: 401, message: 'expired', data: null }),
  );
  storage.set('token', 'abc');
  await assert.rejects(api.get('/private'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 401);
    assert.equal(error.message, 'expired');
    return true;
  });
  assert.equal(storage.has('token'), false);
});

test('HTTP failures retain AxiosError response and clear HTTP 401 token', async () => {
  let original;
  const { api, storage } = setup(async (config) => {
    const res = { ...response(config, {}), status: 401 };
    original = new axios.AxiosError('unauthorized', 'ERR_BAD_REQUEST', config, null, res);
    throw original;
  });
  storage.set('token', 'abc');
  await assert.rejects(api.get('/private'), (error) => {
    assert.equal(error, original);
    assert.ok(axios.isAxiosError(error));
    assert.equal(error.response.status, 401);
    return true;
  });
  assert.equal(storage.has('token'), false);
});

test('timeout/network errors keep identity and receive readable messages', async () => {
  for (const [code, message] of [
    ['ECONNABORTED', '请求超时，请稍后重试'],
    ['ETIMEDOUT', '请求超时，请稍后重试'],
    ['ERR_NETWORK', '网络连接异常，请检查网络'],
  ]) {
    const original = new axios.AxiosError('failed', code);
    const { api } = setup(async () => {
      throw original;
    });
    await assert.rejects(
      api.get('/items'),
      (error) => error === original && error.message === message,
    );
  }
});

test('AbortController cancellation remains identifiable and skips adapter', async () => {
  let called = false;
  const { api } = setup(async (config) => {
    called = true;
    return response(config, {});
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.get('/items', undefined, { signal: controller.signal }), axios.isCancel);
  assert.equal(called, false);
});

test('malformed envelope rejects rather than returning silent undefined', async () => {
  const { api } = setup(async (config) => response(config, { list: [] }));
  await assert.rejects(api.get('/items'), /接口响应格式错误/);
});

test('device Mock matches the response envelope and pagination contract', async () => {
  const { queryDevices } = load('mock/devices.ts');
  const { api } = setup(async (config) =>
    response(config, { code: 200, message: 'ok', data: queryDevices(config.params) }),
  );
  const { data } = await api.get('/api/devices', { page: 2, pageSize: 10 });
  assert.equal(data.list.length, 10);
  assert.equal(data.page, 2);
  assert.equal(data.total, 60);
});

test('default client uses cookie/CSRF settings and never reads a legacy token implicitly', async () => {
  let request;
  const module = load('src/net/axios/index.ts');
  const api = module.default({
    adapter: async (config) => {
      request = config;
      return response(config, { code: 200, message: 'ok', data: null });
    },
  });
  await api.get('/api/auth/session');
  assert.equal(request.withCredentials, true);
  assert.equal(request.xsrfCookieName, 'XSRF-TOKEN');
  assert.equal(request.xsrfHeaderName, 'X-XSRF-TOKEN');
  assert.equal(request.headers.has('Authorization'), false);
});

test('stale 401 cannot invalidate a new session; concurrent 401 expires only once', async () => {
  const pending = [];
  let version = 0,
    expired = 0;
  const module = load('src/net/axios/index.ts');
  const api = module.default(
    { adapter: (config) => new Promise((resolve) => pending.push({ config, resolve })) },
    {
      getSessionVersion: () => version,
      onUnauthorized() {
        expired++;
        version++;
      },
    },
  );
  const old = api.get('/old').catch((error) => error);
  await new Promise((resolve) => setImmediate(resolve));
  version++;
  pending[0].resolve(response(pending[0].config, { code: 401, message: 'expired' }));
  await old;
  assert.equal(expired, 0);
  const first = api.get('/one').catch((error) => error),
    second = api.get('/two').catch((error) => error);
  await new Promise((resolve) => setImmediate(resolve));
  for (const request of pending.slice(1)) request.resolve(response(request.config, { code: 401 }));
  await Promise.all([first, second]);
  assert.equal(expired, 1);
});
