import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function logout(page: Page) {
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
}

async function login(page: Page, username: string, destination = '/device') {
  await page.goto(destination);
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole('textbox', { name: '用户名' }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

test('viewer restores session after reload, cannot edit, cannot navigate to playground', async ({
  page,
}) => {
  await login(page, 'viewer');
  await expect(page).toHaveURL('/device');
  await expect(page.getByRole('menuitem', { name: '设备列表' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'WebSocket 演示' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '编辑', exact: true })).toHaveCount(0);
  await expect(page.locator('.el-table__body-wrapper tbody tr')).toHaveCount(10);
  await page.reload();
  await expect(page).toHaveURL('/device');
  await expect(page.locator('.account-name')).toBeVisible();
  await page.goto('/playground/websocket');
  await expect(page).toHaveURL('/403');
  await logout(page);
  await expect(page).toHaveURL('/login');
  await page.goto('/device');
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test('admin edits through authenticated CSRF-protected API and sees saved value after refresh', async ({
  page,
}) => {
  await login(page, 'admin');
  await expect(page).toHaveURL('/device');
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: '名称', exact: true }).fill('权限测试设备');
  const saved = page.waitForResponse(
    (res) => res.request().method() === 'PATCH' && res.url().includes('/api/devices/'),
  );
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(dialog).toBeHidden();
  await expect(page.getByText('权限测试设备', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('权限测试设备', { exact: true })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find((item) => item.name === 'mock-session')?.httpOnly).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

test('tester lands on permitted page and unsafe redirect stays inside the application', async ({
  page,
}) => {
  await login(page, 'tester', '/login?redirect=//evil.test');
  await expect(page).toHaveURL('/playground/charts');
  await expect(page.getByRole('menuitem', { name: '设备列表' })).toHaveCount(0);
  await page.goto('/device');
  await expect(page).toHaveURL('/403');
});

test('wrong credentials show an error, expired cookie returns to login without redirect loops', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '用户名' }).fill('viewer');
  await page.getByLabel('密码', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('用户名或密码错误');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL('/device');
  await context.clearCookies();
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
});

test('logout in another tab revokes session and hides protected content on focus', async ({
  page,
  context,
}) => {
  await login(page, 'viewer');
  await expect(page).toHaveURL('/device');
  const other = await context.newPage();
  await other.goto('/device');
  await expect(other.locator('.account-name')).toBeVisible();
  await logout(other);
  await expect(other).toHaveURL('/login');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('.el-table')).toHaveCount(0);
});

test('nested menu opens ancestors on direct links, highlights leaf and supports collapsed popups', async ({
  page,
}) => {
  await login(page, 'admin');
  await expect(page).toHaveURL('/device');
  await page
    .locator('.app-menu > .el-sub-menu > .el-sub-menu__title')
    .filter({ hasText: '开发演示' })
    .click();
  await page.getByRole('menuitem', { name: 'WebSocket 演示', exact: true }).click();
  await expect(page).toHaveURL('/playground/websocket');
  await expect(page.locator('.app-menu .el-menu-item.is-active')).toHaveText('WebSocket 演示');
  await page.reload();
  await expect(
    page.locator('.app-menu > .el-sub-menu').filter({ hasText: '开发演示' }),
  ).toHaveClass(/is-opened/);
  await expect(page.getByRole('menuitem', { name: 'WebSocket 演示', exact: true })).toBeVisible();
  await page.locator('#aside-btn').click();
  await expect(page.locator('.app-menu')).toHaveClass(/el-menu--collapse/);
  await page
    .locator('.app-menu > .el-sub-menu > .el-sub-menu__title')
    .filter({ hasText: '开发演示' })
    .hover();
  await expect(
    page.locator('.el-menu--popup').getByRole('menuitem', { name: 'WebSocket 演示', exact: true }),
  ).toBeVisible();
});

test('six-level fixture caps indentation, truncates labels and expands without shrinking first', async ({
  page,
}) => {
  const title = '这是用于验证多级菜单长标题不会撑宽侧栏的完整页面名称';
  // 仅在此测试的浏览器响应中增加路由，不给生产菜单添加虚构页面。
  await page.route('**/src/router/routes.ts*', async (request) => {
    const response = await request.fetch();
    const fixture = `\nlet tree = {
      path: 'leaf', name: 'fixture-leaf', component: () => import('/src/views/playground/WebSocketDemo.vue'),
      meta: { menu: true, title: ${JSON.stringify(title)} }
    };
    for (let depth = 4; depth >= 0; depth--) tree = {
      path: depth === 0 ? 'menu-fixture' : 'l' + depth, name: 'fixture-' + depth,
      meta: { menu: true, title: '分组' + depth, icon: 'Folder', permissions: ['devices:read'] }, children: [tree]
    };
    tree.children.push({path: 'sibling', name: 'fixture-sibling', component: () => import('/src/views/playground/WebSocketDemo.vue'), meta: { menu: true, title: '同级页面' }});
    routes.find(r => r.name === 'layout').children.push(tree);\n`;
    await request.fulfill({ response, body: (await response.text()) + fixture });
  });
  await login(page, 'viewer', '/menu-fixture/l1/l2/l3/l4/leaf');
  await expect(page).toHaveURL('/menu-fixture/l1/l2/l3/l4/leaf');
  await expect(page.locator('.app-menu .el-sub-menu.is-opened')).toHaveCount(5);
  const rows = page
    .locator('.app-menu > .el-sub-menu')
    .filter({ hasText: '分组0' })
    .locator('.el-sub-menu__title, .el-menu-item');
  const bounds = await rows.evaluateAll((elements) =>
    elements.map((el) => ({
      left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right,
      label: el.querySelector('.menu-label')!.getBoundingClientRect().left,
    })),
  );
  expect(bounds.every((row) => Math.abs(row.left - bounds[0]!.left) < 1)).toBe(true);
  expect(bounds.map((row) => row.label - bounds[0]!.label)).toEqual([0, 8, 16, 24, 24, 24, 8]);
  expect(bounds.every((row) => Math.abs(row.right - bounds[0]!.right) < 1)).toBe(true);
  const label = page.locator('.app-menu .el-menu-item.is-active .menu-label');
  await expect(label).toHaveAttribute('title', title);
  await expect.poll(() => label.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect
    .poll(() =>
      page.locator('.app-menu').evaluate((el) => Math.round(el.getBoundingClientRect().width)),
    )
    .toBe(220);
  await page.evaluate(() =>
    document.getElementById('app')!.style.setProperty('--app-sidebar-menu-width', '260px'),
  );
  await expect
    .poll(() =>
      page.locator('.app-menu').evaluate((el) => Math.round(el.getBoundingClientRect().width)),
    )
    .toBe(260);
  const childWidths = await page
    .locator('.app-menu .el-menu')
    .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().width));
  expect(childWidths.every((width) => width <= 260)).toBe(true);
  await page.locator('#aside-btn').click();
  await expect(page.locator('.app-menu')).toHaveClass(/el-menu--collapse/);
  await expect
    .poll(() =>
      page.locator('.app-menu').evaluate((el) => Math.round(el.getBoundingClientRect().width)),
    )
    .toBe(64);
  await expect
    .poll(() =>
      page.locator('.menu-viewport').evaluate((el) => Math.round(el.getBoundingClientRect().width)),
    )
    .toBe(64);
  const samples = await page.evaluate(
    () =>
      new Promise<{
        widths: number[];
        frames: { viewport: number; child: number; textVisible: boolean }[];
      }>((resolve) => {
        const widths: number[] = [];
        const frames: { viewport: number; child: number; textVisible: boolean }[] = [];
        const start = performance.now();
        function sample() {
          const menu = document.querySelector('.app-menu');
          if (menu) {
            widths.push(menu.getBoundingClientRect().width);
            const viewport = document.querySelector('.menu-viewport')!;
            const child = menu.querySelector('.el-menu-item.is-active');
            const text = child?.querySelector('.menu-label');
            frames.push({
              viewport: viewport.getBoundingClientRect().width,
              child: child?.getBoundingClientRect().width ?? 0,
              textVisible:
                !!text &&
                getComputedStyle(text).visibility === 'visible' &&
                text.getBoundingClientRect().height > 0,
            });
          }
          if (performance.now() - start < 650) requestAnimationFrame(sample);
          else resolve({ widths, frames });
        }
        sample();
        document.querySelector<HTMLButtonElement>('#aside-btn')!.click();
      }),
  );
  expect(Math.min(...samples.widths)).toBeGreaterThanOrEqual(63.5);
  expect(samples.widths.at(-1)).toBeCloseTo(260, 0);
  const duringExpansion = samples.frames.filter(
    (frame) => frame.viewport > 80 && frame.viewport < 250,
  );
  expect(duringExpansion.length).toBeGreaterThan(0);
  expect(
    duringExpansion.every(
      (frame) => frame.textVisible && Math.abs(frame.child - samples.frames.at(-1)!.child) < 1,
    ),
    JSON.stringify(samples.frames),
  ).toBe(true);
  await expect(page.locator('.app-menu .el-sub-menu.is-opened')).toHaveCount(5);
});

test('same-level menu labels align while nested labels keep their indentation', async ({
  page,
}) => {
  await login(page, 'admin');
  await expect(page).toHaveURL('/device');
  const labels = page.locator(
    '.app-menu > .el-menu-item .menu-label, .app-menu > .el-sub-menu > .el-sub-menu__title .menu-label',
  );
  await expect(labels).toHaveCount(4);
  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 900 });
    const positions = await labels.evaluateAll((elements) =>
      elements.map((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return { text: range.getBoundingClientRect().left, box: el.getBoundingClientRect().left };
      }),
    );
    expect(positions.every((position) => Math.abs(position.text - positions[0].text) <= 1)).toBe(
      true,
    );
    for (const position of positions)
      expect(Math.abs(position.text - position.box)).toBeLessThanOrEqual(1);
  }
  await page
    .locator('.app-menu > .el-sub-menu > .el-sub-menu__title')
    .filter({ hasText: '开发演示' })
    .click();
  const child = page
    .locator('.app-menu .el-menu--inline .menu-label')
    .filter({ hasText: 'WebSocket 演示' });
  await expect(child).toBeVisible();
  const left = await child.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().left;
  });
  const rootLeft = await labels.first().evaluate((el) => el.getBoundingClientRect().left);
  expect(left - rootLeft).toBeCloseTo(8, 0);
  const parent = page
    .locator('.app-menu > .el-sub-menu > .el-sub-menu__title')
    .filter({ hasText: '开发演示' });
  const parentBox = await parent.boundingBox();
  const childBox = await child.locator('..').boundingBox();
  expect(childBox!.x).toBe(parentBox!.x);
  expect(childBox!.width).toBe(parentBox!.width);
  for (let repeat = 0; repeat < 3; repeat++) {
    await parent.click();
    await expect(child).toBeHidden();
    await parent.click();
    await expect(child).toBeVisible();
  }
});

test('account navigation shows session details, saves profile and keeps permissions immutable', async ({
  page,
}) => {
  await login(page, 'viewer');
  await expect(page).toHaveURL('/device');
  await page.getByRole('button', { name: '账户菜单' }).click();
  await expect(page.getByText('viewer@example.test', { exact: true })).toBeVisible();
  await page
    .getByRole('menu', { name: '账户菜单' })
    .getByRole('menuitem', { name: '个人中心', exact: true })
    .click();
  await expect(page).toHaveURL('/account/center');
  await expect(page.getByRole('heading', { name: '账户信息', exact: true })).toBeVisible();
  await expect(page.locator('.app-menu .el-menu-item.is-active')).toHaveText('个人中心');
  await expect(page.locator('.app-menu > .el-sub-menu.is-active')).toHaveCount(1);
  await expect(
    page.locator('.app-menu > .el-sub-menu.is-active > .el-sub-menu__title'),
  ).toContainText('系统管理');
  await page.screenshot({ path: 'artifacts/account-under-system.png', fullPage: true });
  await expect(
    page.locator('.app-menu').getByRole('menuitem', { name: '个人设置', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('设备观察员', { exact: true }).first()).toBeVisible();
  const originalName = await page.locator('.account-name').textContent();
  await page.getByRole('button', { name: '编辑个人资料' }).click();
  await expect(page).toHaveURL('/account/center?edit=1');
  await page.getByRole('textbox', { name: '昵称', exact: true }).fill('尚未保存的昵称');
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  await expect(page).toHaveURL('/account/center');
  await expect(page.locator('.account-name')).not.toHaveText('尚未保存的昵称');
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByRole('menuitem', { name: '个人设置', exact: true }).click();
  await expect(page).toHaveURL('/account/center?edit=1');
  await expect(page.getByRole('textbox', { name: '昵称', exact: true })).toHaveValue(originalName!);
  await page.reload();
  await page.getByRole('textbox', { name: '昵称', exact: true }).fill('导航测试用户');
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('nav-test@example.test');
  await page.route(
    '**/api/auth/profile',
    (route) =>
      route.fulfill({ status: 500, json: { code: 500, message: '模拟保存失败', data: null } }),
    { times: 1 },
  );
  await page.getByRole('button', { name: '更新个人资料', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL('/account/center?edit=1');
  await expect(page.getByRole('textbox', { name: '昵称', exact: true })).toHaveValue(
    '导航测试用户',
  );
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/profile') && response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: '更新个人资料', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: '个人资料已更新' })).toBeVisible();
  await expect(page.locator('.account-name')).toHaveText('导航测试用户');
  await expect(page).toHaveURL('/account/center');
  await page.reload();
  await expect(page.locator('.profile-card h2')).toHaveText('导航测试用户');
  await page.goto('/account/settings');
  await expect(page).toHaveURL('/account/center?edit=1');
  await expect(page.getByRole('textbox', { name: '昵称', exact: true })).toHaveValue(
    '导航测试用户',
  );
  await page.goto('/device');
  await expect(page.getByRole('button', { name: '编辑', exact: true })).toHaveCount(0);
});

test('navigation search filters by permission and theme persists after refresh', async ({
  page,
}) => {
  await login(page, 'tester');
  await expect(page).toHaveURL('/playground/charts');
  await page.getByRole('button', { name: '搜索导航' }).click();
  const search = page.getByRole('dialog', { name: '导航搜索' });
  await expect(search.getByRole('option').filter({ hasText: '设备列表' })).toHaveCount(0);
  await search.getByRole('combobox', { name: '搜索页面' }).fill('个人中心');
  await expect(search.getByRole('option')).toHaveCount(1);
  await search.getByRole('combobox', { name: '搜索页面' }).press('Enter');
  await expect(page).toHaveURL('/account/center');
  await page.getByRole('button', { name: '切换主题' }).click();
  await page.getByRole('menuitem', { name: '深色模式', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: '账户菜单' }).click();
  await expect(page.getByRole('menuitem', { name: '主题设置', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换主题' }).click();
  await page.getByRole('menuitem', { name: '浅色模式', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('header stays usable on mobile and shared sidebar controls remain synchronized', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'admin', '/account/center');
  await expect(page).toHaveURL('/account/center');
  await expect(page.locator('.app-header')).toBeVisible();
  await expect(page.locator('.app-menu')).toHaveClass(/el-menu--collapse/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: '账户菜单' }).click();
  await expect(page.getByRole('menuitem', { name: '个人设置', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: '个人设置', exact: true }).click();
  await expect(page).toHaveURL('/account/center?edit=1');
  await expect(page.getByRole('textbox', { name: '昵称', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.collapse-action')).toHaveCount(0);
  await page.locator('#aside-btn').click();
  await expect(page.locator('#aside-btn')).toHaveAttribute('aria-expanded', 'true');
});
