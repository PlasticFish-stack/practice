import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function login(page: Page, path = '/system/users') {
  await page.goto(path);
  await page.getByRole('textbox', { name: '用户名' }).fill('admin');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(path);
}
async function fixture(page: Page, component = 'ComponentsHarness.vue') {
  await page.route('**/src/router/routes.ts*', async (request) => {
    const response = await request.fetch();
    await request.fulfill({
      response,
      body:
        (await response.text()) +
        `\nroutes.find(r => r.name === 'layout').children.push({
      path: 'component-fixture', name: 'component-fixture',
      component: () => import('/tests/fixtures/${component}'),
      meta: { title: '组件测试', permissions: ['system:users:read'] }
    });`,
    });
  });
  await login(page, '/component-fixture');
  if (component === 'ComponentsHarness.vue') await page.getByPlaceholder('选择测试日期').waitFor();
}

for (const theme of ['light', 'dark']) {
  test(`striped cells keep the range highlight through hover and restore on clear (${theme})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript((theme) => localStorage.setItem('ui.theme', theme), theme);
    await fixture(page, 'StripedTableHarness.vue');
    const table = page.locator('.app-table');
    const rows = table.locator('.el-table__body > tbody > tr.el-table__row');
    const start = rows.nth(0).locator('td').nth(1);
    const finish = rows.nth(3).locator('td').nth(2);
    await page.getByRole('heading', { name: '测试条纹表格', exact: true }).hover();
    const plainBackground = await start.evaluate((cell) => getComputedStyle(cell).backgroundColor);
    const stripeBackground = await finish.evaluate(
      (cell) => getComputedStyle(cell).backgroundColor,
    );
    expect(stripeBackground).not.toBe(plainBackground);
    const expected = await table.evaluate((element) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'var(--el-color-primary-light-9)';
      element.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });
    const from = (await start.boundingBox())!;
    const to = (await finish.boundingBox())!;
    await page.mouse.move(from.x + 10, from.y + 10);
    await page.mouse.down();
    await page.mouse.move(to.x + 10, to.y + 10, { steps: 12 });
    await page.mouse.up();
    const selected = table.locator('td.is-cell-selected');
    await expect(selected).toHaveCount(8);
    await expect(finish).toHaveClass(/is-cell-active/);
    for (const cell of await selected.all()) {
      await expect(cell).toHaveCSS('background-color', expected);
    }
    // A striped row under the pointer must still use the selection background.
    await rows.nth(1).locator('td').nth(1).hover();
    for (const cell of await selected.all()) {
      await expect(cell).toHaveCSS('background-color', expected);
    }
    await page.getByRole('heading', { name: '测试条纹表格', exact: true }).hover();
    await page.screenshot({ path: `artifacts/table-range-${theme}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await expect(selected).toHaveCount(0);
    await expect(start).toHaveCSS('background-color', plainBackground);
    await expect(finish).toHaveCSS('background-color', stripeBackground);
  });
}

test('schema form validates, preserves focus and zero, supports custom fields and resets safely', async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole('button', { name: '提交', exact: true }).click();
  await expect(page.getByText('名称不能为空', { exact: true })).toBeVisible();
  const name = page.getByRole('textbox', { name: '测试名称', exact: true });
  await name.pressSequentially('连续输入');
  await expect(name).toBeFocused();
  await expect(name).toHaveValue('连续输入');
  await page.getByRole('spinbutton', { name: '测试数量', exact: true }).fill('0');
  const notesSwitch = page.getByRole('switch', { name: '显示备注', exact: true });
  await page.locator('.el-switch').filter({ has: notesSwitch }).click();
  await expect(notesSwitch).toBeChecked();
  await page.getByRole('textbox', { name: '自定义备注' }).fill('自定义内容');
  await page
    .locator('.el-select')
    .filter({ has: page.getByRole('combobox', { name: '测试状态', exact: true }) })
    .click();
  await page.getByRole('option', { name: '在线', exact: true }).click();
  await page.getByPlaceholder('选择测试日期').fill('2026-11-04');
  await page.getByPlaceholder('选择测试日期').press('Enter');
  await page.getByRole('button', { name: '提交', exact: true }).click();
  const output = page.getByLabel('提交结果');
  await expect(output).toContainText('连续输入');
  const value = JSON.parse((await output.textContent()) || '{}');
  expect(value).toMatchObject({
    name: '连续输入',
    count: 0,
    enabled: true,
    notes: '自定义内容',
    status: 'online',
    date: '2026-11-04',
  });
  await page.getByRole('button', { name: '切换忙碌', exact: true }).click();
  await expect(name).toBeDisabled();
  await expect(page.getByRole('textbox', { name: '自定义备注' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '重置', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '切换忙碌', exact: true }).click();
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(name).toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: '测试数量', exact: true })).toHaveValue('0');
  await expect(page.getByRole('textbox', { name: '自定义备注' })).toHaveCount(0);
  await expect(page.getByText('名称不能为空', { exact: true })).toHaveCount(0);
});

test('table forwards native columns and events, honors template slots, supports expansion and reactive columns', async ({
  page,
}) => {
  await fixture(page);
  const table = page.locator('.app-table');
  await expect(table.getByRole('columnheader', { name: '基础信息', exact: true })).toBeVisible();
  await expect(table.getByText('slot-A', { exact: true })).toBeVisible();
  await expect(table.getByLabel('自定义筛选')).toBeVisible();
  await expect(table.getByText('render-A', { exact: true })).toHaveCount(0);
  expect(
    await table
      .getByRole('columnheader')
      .filter({ hasText: '标识' })
      .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
  ).toBe(100);
  await table.locator('.el-table__header-wrapper .el-checkbox').click();
  await expect(page.getByLabel('选择数量')).toHaveText('2');
  await table
    .getByRole('columnheader')
    .filter({ hasText: '标识' })
    .locator('.sort-caret.ascending')
    .click();
  await expect(page.getByLabel('排序状态')).toHaveText('ascending');
  await table.locator('.el-table__expand-icon').first().click();
  await expect(table.getByText('展开内容 A', { exact: true })).toBeVisible();
  const count = table.getByRole('spinbutton').first();
  await count.fill('5');
  await count.fill('0');
  await count.blur();
  await expect(count).toHaveValue('0');
  await page.getByRole('button', { name: '切换数量列', exact: true }).click();
  await expect(table.getByRole('columnheader', { name: '数量', exact: true })).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: '指标', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '切换数量列', exact: true }).click();
  await expect(table.getByRole('columnheader', { name: '数量', exact: true })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '指标', exact: true })).toBeVisible();
  await table.getByRole('button', { name: '删除 A', exact: true }).click();
  await expect(table.getByText('slot-A', { exact: true })).toHaveCount(0);
  await expect(table.getByText('slot-B', { exact: true })).toBeVisible();
});
