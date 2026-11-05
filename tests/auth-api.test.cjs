const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { createLoader } = require('./helpers/load-ts.cjs');

test('HTTP session, CSRF, authorization, profile updates and logout are enforced server-side', async () => {
  const handle = createLoader()('mock/server.ts').createMockApi();
  const server = createServer((req, res) => {
    void handle(req, res, () => {
      res.statusCode = 404;
      res.end();
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    const cookies = new Map();
    return {
      cookies,
      async request(path, { method = 'GET', data, csrf = true } = {}) {
        const headers = {
          Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          'Content-Type': 'application/json',
          Origin: base,
        };
        if (csrf && cookies.has('XSRF-TOKEN')) headers['X-XSRF-TOKEN'] = cookies.get('XSRF-TOKEN');
        const response = await fetch(base + path, {
          method,
          headers,
          body: data === undefined ? undefined : JSON.stringify(data),
        });
        for (const cookie of response.headers.getSetCookie()) {
          const [name, value] = cookie.split(';')[0].split('=');
          cookies.set(name, value);
        }
        return { response, body: await response.json() };
      },
      async login(username) {
        await this.request('/api/auth/csrf');
        return this.request('/api/auth/login', {
          method: 'POST',
          data: { username, password: 'Demo@123456' },
        });
      },
    };
  }
  try {
    const anonymous = client();
    assert.equal((await anonymous.request('/api/system/users')).response.status, 401);
    assert.equal(
      (await anonymous.request('/api/auth/login', { method: 'POST', csrf: false, data: {} }))
        .response.status,
      403,
    );
    await anonymous.request('/api/auth/csrf');
    assert.equal(
      (
        await anonymous.request('/api/auth/login', {
          method: 'POST',
          data: { username: 'admin', password: 'wrong' },
        })
      ).response.status,
      401,
    );

    const viewer = client();
    const loggedIn = await viewer.login('viewer');
    assert.equal(loggedIn.response.status, 200);
    assert.ok(loggedIn.response.headers.getSetCookie()[0].includes('HttpOnly'));
    assert.equal(Object.hasOwn(loggedIn.body.data, 'token'), false);
    assert.equal((await viewer.request('/api/system/users')).response.status, 403);
    const changedProfile = {
      displayName: '测试观察员',
      email: 'updated@example.test',
      phone: '',
      title: '观察员',
      department: '监控组',
      bio: '更新后的简介',
      avatarUrl: '',
    };
    assert.equal(
      (
        await viewer.request('/api/auth/profile', {
          method: 'PATCH',
          data: changedProfile,
          csrf: false,
        })
      ).response.status,
      403,
    );
    const updated = await viewer.request('/api/auth/profile', {
      method: 'PATCH',
      data: changedProfile,
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.displayName, '测试观察员');
    assert.equal(
      (
        await viewer.request('/api/auth/profile', {
          method: 'PATCH',
          data: { ...changedProfile, roles: ['admin'] },
        })
      ).response.status,
      400,
    );
    assert.deepEqual((await viewer.request('/api/auth/session')).body.data.permissions, []);
    const oldSession = viewer.cookies.get('mock-session');
    await viewer.login('viewer');
    assert.notEqual(viewer.cookies.get('mock-session'), oldSession);
    const stale = client();
    stale.cookies.set('mock-session', oldSession);
    assert.equal((await stale.request('/api/auth/session')).response.status, 401);

    const tester = client();
    await tester.login('tester');
    assert.equal((await tester.request('/api/system/users')).response.status, 403);
    const admin = client();
    await admin.login('admin');
    const users = await admin.request('/api/system/users?page=1&pageSize=2');
    assert.equal(users.response.status, 200);
    assert.equal(users.body.data.list.length, 2);
    assert.equal(users.body.data.total, 3);
    await admin.request('/api/auth/logout', { method: 'POST' });
    assert.equal((await admin.request('/api/auth/session')).response.status, 401);
    assert.equal((await admin.request('/api/system/users')).response.status, 401);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
