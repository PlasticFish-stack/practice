import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, username = 'admin', path = '/') {
  await page.goto(path);
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

test('base has only system navigation and no product branding', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL('/system/users');
  await expect(page).toHaveTitle('用户管理 · 后台管理');
  await expect(page.locator('.app-menu > .el-sub-menu > .el-sub-menu__title')).toHaveText([
    '系统管理',
  ]);
  await expect(page.locator('.app-menu .el-menu-item')).toHaveText([
    '用户管理',
    '角色管理',
    '菜单管理',
    '个人中心',
  ]);
  await expect(page.locator('.app-header img, .app-sidebar img')).toHaveCount(0);
  await expect(page.locator('link[rel="icon"], link[rel="apple-touch-icon"]')).toHaveCount(0);
  await expect(page.locator('.header-page-title')).toHaveText('用户管理');
  await page.screenshot({ path: 'artifacts/base-desktop.png', fullPage: true });
});

test('ordinary accounts land on their profile and cannot enter system management', async ({
  page,
}) => {
  await login(page, 'viewer');
  await expect(page).toHaveURL('/account/center');
  await expect(page.locator('.app-menu .el-menu-item')).toHaveText(['个人中心']);
  await page.goto('/system/users');
  await expect(page).toHaveURL('/403');
  expect((await page.request.get('/api/system/users')).status()).toBe(403);
});

test('removed business pages and APIs are unavailable', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL('/system/users');
  for (const path of [
    '/device',
    '/playground/charts',
    '/playground/terminal',
    '/playground/websocket',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
  }
  expect((await page.request.get('/api/devices')).status()).toBe(404);
});

test('theme, tabs and sidebar controls work on mobile without branding', async ({ page }) => {
  await login(page, 'admin', '/system/users');
  await expect(page).toHaveURL('/system/users');
  await page.getByRole('menuitem', { name: '角色管理', exact: true }).click();
  await expect(page).toHaveURL('/system/roles');
  await page.getByRole('tab', { name: '用户管理', exact: true }).click();
  await expect(page).toHaveURL('/system/users');
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await page.getByRole('menuitem', { name: '深色模式', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.locator('.app-header .collapse-action');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(page.locator('.header-page-title')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/base-mobile.png', fullPage: true });
});

test('expired sessions hide protected pages and retain the return destination', async ({
  page,
}) => {
  await login(page, 'admin', '/system/roles');
  await expect(page).toHaveURL('/system/roles');
  await page.context().clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.locator('.app-sidebar')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/system/roles');
});
