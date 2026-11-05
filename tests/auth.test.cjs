const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPinia } = require('pinia');
const axios = require('axios');
const { createRouter, createMemoryHistory } = require('vue-router');
const { createLoader } = require('./helpers/load-ts.cjs');
const profile = (permissions) => ({
  id: '1',
  username: 'user',
  displayName: 'User',
  roles: ['viewer'],
  permissions,
});
const unauthorized = () =>
  new axios.AxiosError('expired', 'ERR_BAD_REQUEST', undefined, null, { status: 401 });
function setup(api = {}) {
  const authApi = {
    session: async () => {
      throw unauthorized();
    },
    login: async () => profile([]),
    logout: async () => {},
    ...api,
  };
  const load = createLoader({ 'src/api/auth.ts': { authApi } });
  const auth = load('src/stores/auth.ts').useAuthStore(createPinia());
  const access = load('src/router/access.ts');
  const router = createRouter({
    history: createMemoryHistory(),
    routes: load('src/router/routes.ts').routes,
  });
  access.installAuthGuard(router, auth);
  return { auth, router, access };
}

test('anonymous deep-link goes to login and keeps return destination', async () => {
  const { router } = setup();
  await router.push('/device?page=2');
  assert.equal(router.currentRoute.value.name, 'login');
  assert.equal(router.currentRoute.value.query.redirect, '/device?page=2');
});

test('session restoration grants exact permissions, never privileges based on role names', async () => {
  const { auth, router } = setup({
    session: async () => ({ ...profile(['devices:read']), roles: ['admin'] }),
  });
  await router.push('/device');
  assert.equal(router.currentRoute.value.name, 'devices');
  assert.equal(auth.can('devices:update'), false);
  await router.push('/playground/websocket');
  assert.equal(router.currentRoute.value.name, 'forbidden');
});

test('landing page and menu reflect permissions; personal pages remain available to signed-in users', async () => {
  for (const [permissions, landing] of [
    [['devices:read'], '/device'],
    [['playground:read'], '/playground/charts'],
    [[], '/account/center'],
  ]) {
    const { router, auth, access } = setup({ session: async () => profile(permissions) });
    await router.push('/');
    assert.equal(router.currentRoute.value.path, landing);
    assert.equal(access.accessibleMenus(router, auth).length, permissions.length + 1);
    assert.equal(auth.can('devices:update'), false);
  }
});

test('system group enters the first permitted page; ordinary users can only access their personal center', async () => {
  const manager = setup({ session: async () => profile(['system:roles:read']) });
  await manager.router.push('/system');
  assert.equal(manager.router.currentRoute.value.name, 'system-roles');
  await manager.router.push('/system/users');
  assert.equal(manager.router.currentRoute.value.name, 'forbidden');
  const ordinary = setup({ session: async () => profile(['devices:read']) });
  await ordinary.router.push('/system');
  assert.equal(ordinary.router.currentRoute.value.name, 'account-center');
  const group = ordinary.access
    .accessibleMenus(ordinary.router, ordinary.auth)
    .find((item) => item.index === 'system');
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].index, 'account-center');
  await ordinary.router.push('/system/users');
  assert.equal(ordinary.router.currentRoute.value.name, 'forbidden');
});

test('unsafe login redirects cannot escape app or bypass route permissions', async () => {
  const { router, auth, access } = setup({ session: async () => profile(['devices:read']) });
  await auth.ensureSession();
  for (const value of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/login',
    '/session-error',
    '/playground/websocket',
    '/missing',
    '/',
  ]) {
    assert.equal(access.safeDestination(value, router, auth), '/device');
  }
  assert.equal(
    access.safeDestination('/device?q=lamp#table', router, auth),
    '/device?q=lamp#table',
  );
  await router.push('/login?redirect=//evil.test');
  assert.equal(router.currentRoute.value.path, '/device');
});

test('session outage and malformed response fail closed with a retryable error page', async () => {
  for (const session of [
    async () => {
      throw Error('offline');
    },
    async () => ({ id: 'incomplete' }),
  ]) {
    const { router, auth } = setup({ session });
    await router.push('/device');
    assert.equal(router.currentRoute.value.name, 'session-error');
    assert.equal(auth.authenticated, false);
  }
});

test('concurrent session restoration shares request; late response cannot restore logged-out state', async () => {
  let resolve,
    calls = 0;
  const { auth } = setup({
    session: () => {
      calls++;
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  const first = auth.ensureSession(),
    second = auth.ensureSession();
  assert.equal(calls, 1);
  auth.invalidate();
  resolve(profile(['devices:read']));
  await Promise.all([first, second]);
  assert.equal(auth.authenticated, false);
});

test('logout network failure does not falsely claim the server session was revoked', async () => {
  const { auth } = setup({
    session: async () => profile(['devices:read']),
    logout: async () => {
      throw Error('offline');
    },
  });
  await auth.ensureSession();
  await assert.rejects(auth.logout(), /offline/);
  assert.equal(auth.authenticated, true);
  assert.equal(auth.busy, false);
});

test('parent and child permissions are both required and absence of user denies access', () => {
  const { access, auth } = setup();
  const route = {
    matched: [
      { meta: { permissions: ['devices:read'] } },
      { meta: { permissions: ['devices:update'] } },
    ],
  };
  assert.equal(access.canAccessRoute(route, auth), false);
  auth.user = profile(['devices:update']);
  assert.equal(access.canAccessRoute(route, auth), false);
  auth.user = profile(['devices:update', 'devices:read']);
  assert.equal(access.canAccessRoute(route, auth), true);
});

test('session expiry on a later navigation returns to login', async () => {
  let expired = false;
  const { router, auth } = setup({
    session: async () => {
      if (expired) throw unauthorized();
      return profile(['devices:read']);
    },
  });
  await router.push('/device');
  expired = true;
  await router.push('/device?page=3');
  assert.equal(router.currentRoute.value.name, 'login');
  assert.equal(auth.user, null);
});

test('profile updates use the server result and cannot restore a signed-out user', async () => {
  let resolveSave;
  const { auth } = setup({
    session: async () => profile(['devices:read']),
    updateProfile: () =>
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
  });
  await auth.ensureSession();
  const fields = {
    displayName: 'Updated',
    email: '',
    phone: '',
    title: '',
    department: '',
    bio: '',
    avatarUrl: '',
  };
  const save = auth.saveProfile(fields);
  assert.equal(auth.savingProfile, true);
  resolveSave({ ...profile(['devices:read']), ...fields });
  await save;
  assert.equal(auth.user.displayName, 'Updated');
  assert.equal(auth.savingProfile, false);
  const stale = auth.saveProfile(fields);
  auth.invalidate();
  resolveSave({ ...profile(['devices:read']), ...fields });
  await assert.rejects(stale, /会话已变更/);
  assert.equal(auth.user, null);
});

test('profile validation rejects privilege fields and unsafe avatar sources', () => {
  const load = createLoader();
  const { validateProfile, profileFromUser } = load('src/auth/profile.ts');
  const { parseSessionUser } = load('src/auth/permissions.ts');
  const fields = profileFromUser(profile(['devices:read']));
  assert.equal(validateProfile(fields), null);
  assert.match(validateProfile({ ...fields, permissions: ['devices:update'] }), /不可修改/);
  for (const avatarUrl of [
    'javascript:alert(1)',
    '//external.test/a.png',
    'data:image/svg+xml,test',
    '/\\external.test/a.png',
  ]) {
    assert.match(validateProfile({ ...fields, avatarUrl }), /头像地址/);
  }
  assert.equal(validateProfile({ ...fields, avatarUrl: 'https://example.test/avatar.png' }), null);
  assert.throws(() => parseSessionUser({ ...profile([]), email: 123 }), /无效的会话响应/);
});
