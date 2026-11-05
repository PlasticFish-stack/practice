import { test, expect, type Page } from '@playwright/test';

test('auto virtualization honors threshold, pagination, fallback and keeps selection across switches', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/src/router/routes.ts*', async (request) => {
    const response = await request.fetch();
    await request.fulfill({
      response,
      body:
        (await response.text()) +
        `\nroutes.find(r => r.name === 'layout').children.push({ path: 'virtual-fixture', name: 'virtual-fixture', component: () => import('/tests/fixtures/VirtualTableHarness.vue'), meta: { title: '虚拟表格测试', permissions: ['system:users:read'] } });`,
    });
  });
  await page.goto('/virtual-fixture');
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('admin');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const table = page.locator('.app-table');
  await expect(table).toHaveAttribute('data-render-mode', 'standard');
  await table.locator('tbody tr').first().locator('.el-checkbox').click();
  await expect(page.getByLabel('选中数量')).toHaveText('1');
  await page.getByRole('button', { name: '500行', exact: true }).click();
  await expect(table).toHaveAttribute('data-render-mode', 'virtual');
  await expect(table.getByRole('checkbox', { name: '选择行' }).first()).toBeChecked();
  await expect(table.getByText('名称：记录-0', { exact: true })).toBeVisible();
  expect(await table.locator('.el-table-v2__row').count()).toBeLessThan(40);
  const cell = table.locator('[data-row-index="0"][data-column-index="2"]').first();
  await cell.click();
  await expect(cell).toHaveClass(/is-cell-active/);
  await page.keyboard.press('ArrowDown');
  await expect(table.locator('[data-row-index="1"][data-column-index="2"]').first()).toHaveClass(
    /is-cell-active/,
  );
  const copied = await table.locator('.virtual-table').evaluate((element) => {
    const clipboardData = new DataTransfer();
    element.dispatchEvent(
      new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData }),
    );
    return clipboardData.getData('text/plain');
  });
  expect(copied).toBe('名称：记录-1');
  await page.getByRole('button', { name: '分页开关', exact: true }).click();
  await expect(table).toHaveAttribute('data-render-mode', 'standard');
  await expect(table.locator('tbody tr').first().getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: '分页开关', exact: true }).click();
  await expect(table).toHaveAttribute('data-render-mode', 'virtual');
  await page.getByRole('button', { name: '筛选配置开关' }).click();
  await expect(table).toHaveAttribute('data-render-mode', 'standard');
  await page.getByRole('button', { name: '筛选配置开关' }).click();
  await page.getByRole('button', { name: '499行', exact: true }).click();
  await expect(table).toHaveAttribute('data-render-mode', 'standard');
  await page.getByRole('button', { name: '强制虚拟' }).click();
  await expect(table).toHaveAttribute('data-render-mode', 'virtual');
  await page.getByRole('button', { name: '关闭虚拟' }).click();
  await expect(table).toHaveAttribute('data-render-mode', 'standard');
  await page.getByRole('button', { name: '自动模式' }).click();
  await page.getByRole('button', { name: '万行', exact: true }).click();
  await expect(table).toHaveAttribute('data-render-mode', 'virtual');
  expect(await table.locator('.el-table-v2__row').count()).toBeLessThan(40);
  await table
    .locator('.el-table-v2__body')
    .first()
    .evaluate((element) => {
      const scroller = [element, ...element.querySelectorAll<HTMLElement>('div')].find(
        (item) => item.scrollHeight > item.clientHeight,
      )!;
      scroller.scrollTop = 48000;
      scroller.dispatchEvent(new Event('scroll'));
    });
  await expect(table.getByText('名称：记录-1000', { exact: true })).toBeVisible();
  await table.locator('[data-row-index="1000"][data-column-index="2"]').first().click();
  await page.keyboard.press('Shift+ArrowDown');
  await expect(table.locator('.is-cell-selected')).toHaveCount(2);
  await page.screenshot({ path: 'artifacts/virtual-table.png', fullPage: true });
  expect(errors).toEqual([]);
});

async function virtualFixture(page: Page) {
  await page.route('**/src/router/routes.ts*', async (request) => {
    const response = await request.fetch();
    await request.fulfill({
      response,
      body:
        (await response.text()) +
        `\nroutes.find(r => r.name === 'layout').children.push({ path: 'virtual-fixture', name: 'virtual-fixture', component: () => import('/tests/fixtures/VirtualTableHarness.vue'), meta: { title: '虚拟表格测试', permissions: ['system:users:read'] } });`,
    });
  });
  await page.goto('/virtual-fixture');
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('admin');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('button', { name: '强制虚拟' }).click();
  await expect(page.locator('.app-table')).toHaveAttribute('data-render-mode', 'virtual');
}

test('changing fallthrough attributes rechecks virtual compatibility', async ({ page }) => {
  await virtualFixture(page);
  await page.getByRole('button', { name: '原生属性开关' }).click();
  await expect(page.locator('.app-table')).toHaveAttribute('data-render-mode', 'standard');
  await expect(page.locator('.el-table--striped')).toBeVisible();
  await page.getByRole('button', { name: '原生属性开关' }).click();
  await expect(page.locator('.app-table')).toHaveAttribute('data-render-mode', 'virtual');
});

test('sorting follows column identity when other columns are hidden', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await virtualFixture(page);
  await page.locator('.el-table-v2__header-cell').filter({ hasText: '名称' }).click();
  const firstName = await page
    .locator('.el-table-v2__row')
    .first()
    .locator('.virtual-cell-content')
    .last()
    .innerText();
  await page.getByRole('button', { name: '隐藏编号' }).click();
  await expect(page.locator('.virtual-table')).toBeVisible();
  await expect(
    page.locator('.el-table-v2__row').first().locator('.virtual-cell-content').last(),
  ).toHaveText(firstName);
  expect(errors).toEqual([]);
});

test('refreshing data removes deleted selection and refreshes selected row objects', async ({
  page,
}) => {
  await virtualFixture(page);
  await page.getByRole('checkbox', { name: '选择行' }).first().locator('..').click();
  await expect(page.getByLabel('选中数量')).toHaveText('1');
  await page.getByRole('button', { name: '更新首行' }).click();
  await expect(page.getByLabel('选中名称')).toHaveText('更新-记录-0');
  await page.getByRole('button', { name: '删除首行' }).click();
  await expect(page.getByLabel('选中数量')).toHaveText('0');
});
