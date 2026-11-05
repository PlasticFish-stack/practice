import { test as base, expect, type Page } from '@playwright/test';

const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

async function login(page: Page, path = '/device') {
  await page.goto(path);
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('admin');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(path);
}

test('switching pages does not reopen a manually closed unrelated menu group', async ({ page }) => {
  await login(page);
  const menu = page.locator('.app-menu');
  const playground = menu.locator(':scope > .el-sub-menu').filter({ hasText: '开发演示' });
  const system = menu.locator(':scope > .el-sub-menu').filter({ hasText: '系统管理' });
  await playground.locator(':scope > .el-sub-menu__title').click();
  await system.locator(':scope > .el-sub-menu__title').click();
  await menu.getByRole('menuitem', { name: 'WebSocket 演示', exact: true }).click();
  await expect(page).toHaveURL('/playground/websocket');
  await playground.locator(':scope > .el-sub-menu__title').click();
  await expect(playground).not.toHaveClass(/is-opened/);
  // Keep the next lazy page pending after the session guard, exposing stale-route updates.
  let releasePage!: () => void;
  const pendingPage = new Promise<void>((resolve) => {
    releasePage = resolve;
  });
  await page.route('**/src/views/system/UsersPage.vue*', async (request) => {
    await pendingPage;
    await request.continue();
  });
  try {
    const loadingPage = page.waitForRequest('**/src/views/system/UsersPage.vue*');
    await menu.getByRole('menuitem', { name: '用户管理', exact: true }).click();
    await loadingPage;
    await expect(playground).not.toHaveClass(/is-opened/);
  } finally {
    releasePage();
  }
  await expect(page).toHaveURL('/system/users');
  await expect(playground).not.toHaveClass(/is-opened/);
  await expect(system).toHaveClass(/is-opened/);
  await page.goBack();
  await expect(page).toHaveURL('/playground/websocket');
  await expect(playground).toHaveClass(/is-opened/);
  await expect(menu.getByRole('menuitem', { name: 'WebSocket 演示', exact: true })).toHaveClass(
    /is-active/,
  );
});

test('main navigation prioritizes business pages and scrolls independently in a short viewport', async ({
  page,
}) => {
  const missingIcons: string[] = [];
  page.on('console', (message) => {
    if (/Failed to resolve component/.test(message.text())) missingIcons.push(message.text());
  });
  await page.addInitScript(() => localStorage.setItem('ui.theme', 'light'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  const navigation = page.getByRole('navigation', { name: '主导航', exact: true });
  const menu = navigation.locator('.app-menu');
  await expect(menu.locator(':scope > li > .el-sub-menu__title')).toHaveText([
    '系统管理',
    '开发演示',
  ]);
  await menu
    .locator(':scope > .el-sub-menu > .el-sub-menu__title')
    .filter({ hasText: '系统管理' })
    .click();
  await menu
    .locator(':scope > .el-sub-menu > .el-sub-menu__title')
    .filter({ hasText: '开发演示' })
    .click();
  const demo = menu.locator(':scope > .el-sub-menu').filter({ hasText: '开发演示' });
  await expect(demo.locator('.el-menu-item')).toHaveText([
    '图表演示',
    'WebSocket 演示',
    '终端演示',
  ]);
  await expect(menu.locator('.el-icon:not(.el-sub-menu__icon-arrow) > svg')).toHaveCount(10);
  await page.screenshot({ path: 'artifacts/navigation-light.png', fullPage: true });
  await page.setViewportSize({ width: 1200, height: 360 });
  await expect
    .poll(() => navigation.evaluate((el) => el.scrollHeight > el.clientHeight))
    .toBe(true);
  await navigation.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => navigation.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await menu.getByRole('menuitem', { name: '终端演示', exact: true }).click();
  await expect(page).toHaveURL('/playground/terminal');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(missingIcons).toEqual([]);
});

test('404 returns users without device permission to an accessible home page', async ({ page }) => {
  await page.goto('/missing-page');
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('tester');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  // Unknown login redirects go to the permission-aware landing page.
  await expect(page).toHaveURL('/playground/charts');
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回首页', exact: true }).click();
  await expect(page).toHaveURL('/playground/charts');
});

test('expanding the sidebar restores the active group without opening unrelated groups', async ({
  page,
}) => {
  await login(page, '/playground/websocket');
  const menu = page.locator('.app-menu');
  const playground = menu.locator(':scope > .el-sub-menu').filter({ hasText: '开发演示' });
  const system = menu.locator(':scope > .el-sub-menu').filter({ hasText: '系统管理' });
  await expect(playground).toHaveClass(/is-opened/);
  await page.locator('#aside-btn').click();
  await expect(menu).toHaveClass(/el-menu--collapse/);
  await page.locator('#aside-btn').click();
  await expect(menu).not.toHaveClass(/el-menu--collapse/);
  await expect(playground).toHaveClass(/is-opened/);
  await expect(system).not.toHaveClass(/is-opened/);
});

test('deep-linked nested menus reveal all ancestors after restoring the sidebar', async ({
  page,
}) => {
  await page.route('**/src/router/routes.ts*', async (request) => {
    const response = await request.fetch();
    await request.fulfill({
      response,
      body:
        (await response.text()) +
        `\nroutes.find(r => r.name === 'layout').children.push({
          path: 'sidebar-fixture', name: 'sidebar-fixture', meta: { title: '多级测试', menu: true },
          children: [{ path: 'inner', name: 'sidebar-inner', meta: { title: '二级分组', menu: true },
            children: [{ path: 'page', name: 'sidebar-page', props: { label: 'sidebar' }, component: () => import('/tests/fixtures/PageCacheHarness.vue'),
              meta: { title: '三级页面', menu: true, permissions: ['devices:read'] } }]
          }]
        });`,
    });
  });
  await login(page, '/sidebar-fixture/inner/page');
  const menu = page.locator('.app-menu');
  await expect(menu.getByRole('menuitem', { name: '三级页面', exact: true })).toBeVisible();
  await page.locator('#aside-btn').click();
  await expect(menu).toHaveClass(/el-menu--collapse/);
  await page.locator('#aside-btn').click();
  await expect(menu.getByRole('menuitem', { name: '三级页面', exact: true })).toBeVisible();
  await expect(menu.locator('.el-sub-menu.is-opened')).toHaveCount(2);
});
