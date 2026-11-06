import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const tab = (page: Page, title: string) => page.getByRole('tab', { name: title, exact: true });
async function login(page: Page, username = 'admin', path = '/device') {
  await page.goto(path);
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(path);
}
async function menu(page: Page, title: string) {
  const item = page.locator('.app-menu').getByRole('menuitem', { name: title, exact: true });
  if (!(await item.isVisible()))
    await page
      .locator('.app-menu > .el-sub-menu > .el-sub-menu__title')
      .filter({ hasText: '系统管理' })
      .click();
  await item.click();
  await expect(tab(page, title)).toHaveAttribute('aria-selected', 'true');
}
async function action(page: Page, command: string) {
  await page.getByRole('button', { name: '页签操作', exact: true }).click();
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

test('tabs preserve device filters and pagination; refresh and closing reset the corresponding page', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('textbox', { name: '设备名称', exact: true }).fill('Lamp');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.getByRole('button', { name: 'Go to next page', exact: true }).click();
  await expect(page.locator('.el-pager .is-active')).toHaveText('2');
  await menu(page, '角色管理');
  await page.getByRole('textbox', { name: '搜索角色', exact: true }).fill('未提交的筛选');
  await tab(page, '设备列表').click();
  await expect(page.getByRole('textbox', { name: '设备名称', exact: true })).toHaveValue('Lamp');
  await expect(page.locator('.el-pager .is-active')).toHaveText('2');
  await action(page, '刷新当前');
  await expect(page.getByRole('textbox', { name: '设备名称', exact: true })).toHaveValue('');
  await expect(page.locator('.el-pager .is-active')).toHaveText('1');
  await page.getByRole('button', { name: '关闭页签：设备列表', exact: true }).click();
  await expect(page).toHaveURL('/system/roles');
  await expect(page.getByRole('textbox', { name: '搜索角色', exact: true })).toHaveValue(
    '未提交的筛选',
  );
  await expect(tab(page, '设备列表')).toHaveCount(0);
  await action(page, '关闭全部');
  await expect(page).toHaveURL('/device');
  await expect(page.getByRole('tab')).toHaveCount(1);
});

test('KeepAlive releases closed pages, preserves sibling instances and honors keepAlive false', async ({
  page,
}) => {
  await page.route('**/src/router/routes.ts*', async (request) => {
    const response = await request.fetch();
    const fixture = `\nfor (const key of ['a','b','fresh']) routes.find(r=>r.name==='layout').children.push({
      path:'cache-fixture/'+key,name:'cache-fixture-'+key,component:()=>import('/tests/fixtures/PageCacheHarness.vue'),props:{label:key},
      meta:{title:'缓存测试'+key,menu:true,permissions:['devices:read'],keepAlive:key!=='fresh'}
    });`;
    await request.fulfill({ response, body: (await response.text()) + fixture });
  });
  await login(page, 'admin', '/cache-fixture/a');
  const draft = page.getByRole('textbox', { name: '页签测试草稿' });
  const number = page.getByLabel('实例编号');
  await draft.fill('A 草稿');
  const a = await number.textContent();
  await page.evaluate(() => window.scrollTo(0, 300));
  await menu(page, '缓存测试b');
  await draft.fill('B 草稿');
  const b = await number.textContent();
  await tab(page, '缓存测试a').click();
  await expect(draft).toHaveValue('A 草稿');
  await expect(number).toHaveText(a!);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);
  await tab(page, '缓存测试b').click();
  await page.getByRole('button', { name: '关闭页签：缓存测试a', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { cacheTest?: { events: string[] } }).cacheTest?.events,
      ),
    )
    .toContain(`dispose:a:${a}`);
  await expect(number).toHaveText(b!);
  await menu(page, '缓存测试a');
  await expect(draft).toHaveValue('');
  await expect(number).not.toHaveText(a!);
  await menu(page, '缓存测试fresh');
  await draft.fill('不缓存');
  const fresh = await number.textContent();
  await tab(page, '缓存测试b').click();
  await expect(draft).toHaveValue('B 草稿');
  await tab(page, '缓存测试fresh').click();
  await expect(draft).toHaveValue('');
  await expect(number).not.toHaveText(fresh!);
});

test('tabs support keyboard navigation, grouped closing and a dark mobile overflow strip', async ({
  page,
}) => {
  await login(page);
  await menu(page, '角色管理');
  await menu(page, '菜单管理');
  await menu(page, '用户管理');
  await expect(page.getByRole('tab')).toHaveCount(4);
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await page.getByRole('menuitem', { name: '深色模式', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator('.tab-strip')
        .evaluate((el) => el.scrollWidth > el.clientWidth && el.scrollLeft > 0),
    )
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await tab(page, '用户管理').press('Home');
  await expect(tab(page, '设备列表')).toHaveAttribute('aria-selected', 'true');
  await tab(page, '设备列表').press('End');
  await expect(tab(page, '用户管理')).toHaveAttribute('aria-selected', 'true');
  await tab(page, '角色管理').click();
  await expect(tab(page, '角色管理')).toHaveAttribute('aria-selected', 'true');
  await action(page, '关闭右侧');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(tab(page, '菜单管理')).toHaveCount(0);
  await action(page, '关闭其他');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await tab(page, '角色管理').press('Delete');
  await expect(page).toHaveURL('/device');
  await expect(tab(page, '设备列表')).toHaveAttribute('aria-selected', 'true');
});

test('profile query states share one tab, keep drafts while inactive, and logout clears all tabs', async ({
  page,
}) => {
  await login(page, 'viewer');
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page
    .getByRole('menu', { name: '账户菜单' })
    .getByRole('menuitem', { name: '个人设置', exact: true })
    .click();
  await page.getByRole('textbox', { name: '昵称', exact: true }).fill('尚未保存的页签草稿');
  await expect(tab(page, '个人中心')).toHaveCount(1);
  await tab(page, '设备列表').click();
  await expect(page).toHaveURL('/device');
  await tab(page, '个人中心').click();
  await expect(page).toHaveURL('/account/center?edit=1');
  await expect(page.getByRole('textbox', { name: '昵称', exact: true })).toHaveValue(
    '尚未保存的页签草稿',
  );
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  await expect(tab(page, '个人中心')).toHaveCount(1);
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('tester');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL('/playground/charts');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(tab(page, '设备列表')).toHaveCount(0);
  await expect(tab(page, '个人中心')).toHaveCount(0);
});
