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

async function login(page: Page, username = 'admin', dark = false) {
  await page.addInitScript(
    (value) => localStorage.setItem('ui.theme', value),
    dark ? 'dark' : 'light',
  );
  await page.goto('/playground/charts');
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('charts render, update data, expose states and emit click details', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await login(page);
  await expect(page.locator('.app-chart svg')).toHaveCount(3);
  const trend = page.getByRole('region', { name: '资源使用趋势', exact: true });
  const before = await trend.locator('svg').innerHTML();
  await page.getByRole('button', { name: '更新示例数据', exact: true }).click();
  await expect(page.locator('.sample-version')).toHaveText('数据版本 2');
  await expect.poll(() => trend.locator('svg').innerHTML()).not.toBe(before);
  await page.getByText('加载中', { exact: true }).click();
  await expect(trend).toHaveAttribute('aria-busy', 'true');
  await expect(trend.getByRole('status')).toHaveText('加载中…');
  await page.getByText('空数据', { exact: true }).click();
  await expect(trend.getByRole('status')).toHaveText('暂无数据');
  await page.getByText('加载失败', { exact: true }).click();
  await expect(trend.getByRole('alert')).toHaveText('数据加载失败，请稍后重试');
  await page.getByText('正常', { exact: true }).click();
  await expect(trend.locator('.chart-host')).toBeVisible();
  const bar = page.getByRole('region', { name: '主机流量对比', exact: true });
  await bar.locator('svg path[fill="#1677ff"]').first().click();
  await expect(page.locator('.selection-hint')).toContainText('流入 · Node A：86');
  await page.screenshot({ path: 'artifacts/charts-light.png', fullPage: true });
});

test('charts retain instances and legend state across tabs and theme changes, then release on close', async ({
  page,
}) => {
  await login(page);
  const trend = page.getByRole('region', { name: '资源使用趋势', exact: true });
  const host = trend.locator('.chart-host');
  await expect(host).toHaveAttribute('_echarts_instance_');
  const id = await host.getAttribute('_echarts_instance_');
  const legend = trend.locator('svg text').filter({ hasText: /^CPU$/ });
  const opacity = await legend.getAttribute('fill-opacity');
  await legend.click();
  await expect(legend).not.toHaveAttribute('fill-opacity', opacity!);
  const inactive = await legend.getAttribute('fill-opacity');
  await page.getByRole('button', { name: '更新示例数据', exact: true }).click();
  await page.getByRole('menuitem', { name: '设备列表', exact: true }).click();
  await page.getByRole('tab', { name: '图表演示', exact: true }).click();
  await expect(host).toHaveAttribute('_echarts_instance_', id!);
  await expect(page.locator('.sample-version')).toHaveText('数据版本 2');
  await expect(legend).toHaveAttribute('fill-opacity', inactive!);
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await page.getByRole('menuitem', { name: '深色模式', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(host).toHaveAttribute('_echarts_instance_', id!);
  await expect(legend).not.toHaveAttribute('fill-opacity', opacity!);
  await page.getByRole('button', { name: '关闭页签：图表演示', exact: true }).click();
  await expect(page.locator('.app-chart')).toHaveCount(0);
  await page.getByRole('menuitem', { name: '图表演示', exact: true }).click();
  await expect(host).toHaveAttribute('_echarts_instance_');
  await expect(host).not.toHaveAttribute('_echarts_instance_', id!);
  await expect(page.locator('.sample-version')).toHaveText('数据版本 1');
});

test('dark charts resize with the sidebar and fit a mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1100 });
  await login(page, 'tester', true);
  const trend = page.getByRole('region', { name: '资源使用趋势', exact: true });
  const svg = trend.locator('svg');
  await expect(svg).toBeVisible();
  const width = await svg.getAttribute('width');
  await page.getByRole('banner').getByRole('button', { name: '收起侧栏', exact: true }).click();
  await expect(svg).not.toHaveAttribute('width', width!);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => Number(await svg.getAttribute('width'))).toBeLessThan(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.app-chart svg')).toHaveCount(3);
  await page.screenshot({ path: 'artifacts/charts-dark-mobile.png', fullPage: true });
});

test('users without playground permission cannot open the chart page', async ({ page }) => {
  await login(page, 'viewer');
  await page.goto('/playground/charts');
  await expect(page).toHaveURL('/403');
  await expect(page.locator('.app-chart')).toHaveCount(0);
});
