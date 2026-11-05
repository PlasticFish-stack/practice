const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRouter, createMemoryHistory } = require('vue-router');
const { createLoader } = require('./helpers/load-ts.cjs');

test('menu settings change presentation while page permissions remain enforced on direct URLs', () => {
  const load = createLoader();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: load('src/router/routes.ts').routes,
  });
  const { accessibleMenus, canAccessRoute } = load('src/router/access.ts');
  const { parseSessionUser } = load('src/auth/permissions.ts');
  const setting = {
    routeName: 'system-users',
    title: '用户总览',
    path: '/system/users',
    icon: 'Monitor',
    visible: true,
    order: 80,
    permissions: ['system:users:read'],
    version: 1,
    protected: false,
  };
  const user = parseSessionUser({
    id: 'user',
    username: 'user',
    displayName: 'user',
    roles: ['admin'],
    permissions: ['system:users:read'],
    navigation: [setting],
  });
  const auth = {
    user,
    can: (required) =>
      (typeof required === 'string' ? [required] : required).every((code) =>
        user.permissions.includes(code),
      ),
  };
  assert.equal(
    accessibleMenus(router, auth)[0].children.find((item) => item.index === 'system-users').title,
    '用户总览',
  );
  assert.equal(accessibleMenus(router, auth)[0].children.at(-1).index, 'system-users');
  setting.visible = false;
  assert.equal(
    accessibleMenus(router, auth)[0].children.some((item) => item.index === 'system-users'),
    false,
  );
  assert.equal(canAccessRoute(router.resolve('/system/users'), auth), true);
  setting.permissions.push('system:roles:read');
  assert.equal(canAccessRoute(router.resolve('/system/users'), auth), false);
  assert.throws(
    () =>
      parseSessionUser({ ...user, navigation: [{ ...setting, permissions: 'system:users:read' }] }),
    /无效的菜单配置/,
  );
});
