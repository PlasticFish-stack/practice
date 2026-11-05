const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRouter, createMemoryHistory } = require('vue-router');
const { createLoader } = require('./helpers/load-ts.cjs');
function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: createLoader()('src/router/routes.ts').routes,
  });
}

test('root owns layout and leaves permission-aware landing to the guard', async () => {
  const router = createTestRouter();
  await router.push('/');
  assert.equal(router.currentRoute.value.name, 'layout');
});

test('login is standalone; existing deep links preserve query and hash', async () => {
  const router = createTestRouter();
  await router.push('/login');
  assert.equal(router.currentRoute.value.name, 'login');
  assert.equal(router.currentRoute.value.matched.length, 1);
  await router.push('/playground/websocket?mode=echo#messages');
  assert.equal(router.currentRoute.value.name, 'websocket-demo');
  assert.equal(router.currentRoute.value.query.mode, 'echo');
  assert.equal(router.currentRoute.value.hash, '#messages');
});

test('unknown addresses reach 404 without masking the requested path', async () => {
  const router = createTestRouter();
  await router.push('/missing/nested/page');
  assert.equal(router.currentRoute.value.name, 'not-found');
  assert.equal(router.currentRoute.value.path, '/missing/nested/page');
});

test('implemented pages and their group have menu metadata', () => {
  const menus = createTestRouter()
    .getRoutes()
    .filter((item) => item.meta.menu);
  assert.deepEqual(menus.map((item) => item.path).sort(), [
    '/account/center',
    '/device',
    '/observe',
    '/playground',
    '/playground/charts',
    '/playground/terminal',
    '/playground/websocket',
    '/system',
    '/system/menus',
    '/system/roles',
    '/system/users',
  ]);
  for (const item of menus.filter(
    (item) => !['/account/center', '/system', '/observe'].includes(item.path),
  ))
    assert.ok(item.meta.permissions.length > 0);
});

test('observer uses the existing layout and remains separate from Cookie permissions', async () => {
  const router = createTestRouter();
  const { accessibleMenus, canAccessRoute, installAuthGuard } =
    createLoader()('src/router/access.ts');
  let sessionChecks = 0;
  const auth = {
    user: null,
    authenticated: false,
    can: () => false,
    ensureSession: async () => {
      sessionChecks++;
    },
  };
  installAuthGuard(router, auth);
  await router.push('/observe');
  assert.deepEqual(
    router.currentRoute.value.matched.map((record) => record.name),
    ['layout', 'observe'],
  );
  assert.equal(sessionChecks, 0);
  assert.equal(router.currentRoute.value.meta.public, undefined);
  assert.deepEqual(
    Array.from(accessibleMenus(router, auth), (item) => item.index),
    ['observe'],
  );
  assert.equal(canAccessRoute(router.resolve('/device'), auth), false);
  assert.equal(canAccessRoute(router.resolve('/observe'), auth), true);
  await router.push('/device');
  assert.equal(router.currentRoute.value.name, 'login');
  assert.ok(sessionChecks > 0);
});

test('account group preserves existing URLs and redirects to personal center', async () => {
  const router = createTestRouter();
  await router.push('/account');
  assert.equal(router.currentRoute.value.name, 'account-center');
  await router.push('/account/settings?tab=basic#profile');
  assert.equal(router.currentRoute.value.name, 'account-center');
  assert.equal(router.currentRoute.value.matched.at(-2).name, 'system');
  assert.equal(router.currentRoute.value.fullPath, '/account/center?tab=basic&edit=1#profile');
});

function menuFixture() {
  const page = { render: () => null };
  return [
    {
      path: '/',
      name: 'shell',
      component: page,
      meta: {},
      children: [
        {
          path: 'reports',
          name: 'reports',
          meta: { title: '报表', menu: true, menuOrder: 20 },
          children: [
            {
              path: 'team',
              name: 'team',
              meta: { title: '团队', menu: true },
              children: [
                {
                  path: 'daily',
                  name: 'daily',
                  meta: { title: '日报', menu: true },
                  children: [
                    {
                      path: 'list',
                      name: 'daily-list',
                      component: page,
                      alias: '/daily-alias',
                      meta: { title: '列表', menu: true, permissions: ['devices:read'] },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          path: 'hidden',
          name: 'hidden',
          meta: { permissions: ['playground:read'] },
          children: [
            {
              path: '/absolute',
              name: 'absolute',
              component: page,
              meta: { title: '绝对路径', menu: true, menuOrder: 10 },
            },
          ],
        },
        {
          path: 'devices',
          name: 'fixture-devices',
          component: page,
          meta: { title: '设备', menu: true, menuOrder: 1 },
          children: [{ path: ':id', name: 'device-detail', component: page }],
        },
      ],
    },
  ];
}

test('menu preserves four levels, sibling order, full child paths and avoids alias duplicates', () => {
  const load = createLoader();
  const { buildMenuTree, menuTrail } = load('src/router/menu.ts');
  const router = createRouter({ history: createMemoryHistory(), routes: menuFixture() });
  const tree = buildMenuTree(router, () => true);
  assert.equal(tree[0].index, 'fixture-devices');
  const group = tree.find((node) => node.index === 'reports');
  const leaf = group.children[0].children[0].children[0];
  assert.equal(leaf.path, '/reports/team/daily/list');
  assert.equal(leaf.children.length, 0);
  assert.equal(
    JSON.stringify(menuTrail(tree, 'daily-list')),
    JSON.stringify(['reports', 'team', 'daily', 'daily-list']),
  );
  assert.equal(tree.find((node) => node.index === 'absolute').path, '/absolute');
  assert.equal(JSON.stringify(tree).includes('/daily-alias'), false);
});

test('denied descendants prune empty groups; denied hidden parents do not leak children', () => {
  const { buildMenuTree } = createLoader()('src/router/menu.ts');
  const router = createRouter({ history: createMemoryHistory(), routes: menuFixture() });
  const tree = buildMenuTree(router, (required) => !required.length);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].index, 'fixture-devices');
  // 隐藏详情页不使真实页面变成空分组。
  assert.equal(tree[0].children.length, 0);
});

test('default landing resolves to a permitted leaf rather than the group URL', () => {
  const load = createLoader();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: menuFixture().map((record) => ({
      ...record,
      children: record.children.filter((child) => child.name === 'reports'),
    })),
  });
  const { defaultDestination } = load('src/router/access.ts');
  assert.equal(defaultDestination(router, { can: () => true }), '/reports/team/daily/list');
  assert.equal(defaultDestination(router, { can: (required) => !required.length }), '/403');
});
