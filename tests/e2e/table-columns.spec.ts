import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, path = '/system/menus') {
  await page.goto(path);
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('admin');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

test('column dragging keeps one move target across row controls and rejects locked rows', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: '列设置', exact: true }).click();
  const panel = page.getByRole('region', { name: '表格列设置' });
  const source = panel.getByRole('button', { name: '拖动排序：排序', exact: true });
  const row = panel.locator('[data-column-id="title"]');
  const sourceBox = (await source.boundingBox())!;
  const rowBox = (await row.boundingBox())!;
  const dragEvents: { column: string; accepted: boolean; effect: string }[] = [];
  await page.exposeFunction('recordColumnDrag', (event: (typeof dragEvents)[number]) => {
    dragEvents.push(event);
  });
  await page.evaluate(() => {
    const record = (event: DragEvent) => {
      const row = (event.target as Element).closest<HTMLElement>('[data-column-id]');
      if (!row) return;
      void (
        window as Window & {
          recordColumnDrag: (event: {
            column: string;
            accepted: boolean;
            effect: string;
          }) => Promise<void>;
        }
      ).recordColumnDrag({
        column: row.dataset.columnId!,
        accepted: event.defaultPrevented,
        effect: event.dataTransfer?.dropEffect ?? 'none',
      });
    };
    document.addEventListener('dragenter', record);
    document.addEventListener('dragover', record);
  });
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + 12, sourceBox.y + 12, { steps: 3 });
  // Cross the row's padding, checkbox, buttons and width input using a real native drag.
  for (const y of [rowBox.y + 18, rowBox.y + rowBox.height - 18]) {
    for (const x of [4, 38, 100, 220, rowBox.width - 6]) {
      await page.mouse.move(rowBox.x + x, y, { steps: 3 });
    }
  }
  await page.mouse.up();
  await expect(page.locator('.el-table__header-wrapper th').nth(2)).toHaveText('排序');
  const targetEvents = dragEvents.filter((event) => event.column === 'title');
  expect(targetEvents.length).toBeGreaterThan(10);
  expect(targetEvents.filter((event) => !event.accepted || event.effect !== 'move')).toEqual([]);

  await source.dragTo(panel.locator('.settings-item').first());
  await expect(page.locator('.el-table__header-wrapper th').nth(2)).toHaveText('排序');
  await expect(panel.locator('.is-drop-target')).toHaveCount(0);
});

test('native header resize persists without enabling table borders', async ({ page }) => {
  await login(page);
  const handle = page.getByRole('button', { name: '调整列宽：排序', exact: true });
  const header = page.locator('th').filter({ has: handle });
  await handle.hover();
  const before = (await header.boundingBox())!.width,
    box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => Math.round((await header.boundingBox())!.width))
    .toBe(Math.round(before + 60));
  await page.reload();
  await expect(handle).toBeVisible();
  expect(Math.round((await header.boundingBox())!.width)).toBe(Math.round(before + 60));
});

test('virtual settings survive renderer switches, lock last column and honor source visibility', async ({
  page,
}) => {
  await page.route('**/src/router/routes.ts*', async (request) => {
    const response = await request.fetch();
    await request.fulfill({
      response,
      body:
        (await response.text()) +
        `\nroutes.find(r => r.name === 'layout').children.push({ path: 'virtual-fixture', name: 'virtual-fixture', component: () => import('/tests/fixtures/VirtualTableHarness.vue'), meta: { title: '虚拟表格测试', permissions: ['system:users:read'] } });`,
    });
  });
  await login(page, '/virtual-fixture');
  await page.getByRole('button', { name: '万行', exact: true }).click();
  const table = page.locator('.app-table');
  await expect(table).toHaveAttribute('data-render-mode', 'virtual');
  await page.getByRole('button', { name: '列设置', exact: true }).click();
  const panel = page.getByRole('region', { name: '表格列设置' });
  await panel.getByText('名称', { exact: true }).click();
  await expect(panel.getByRole('checkbox', { name: '编号', exact: true })).toBeDisabled();
  await expect(table.getByText('名称：记录-0', { exact: true })).toHaveCount(0);
  await panel.getByText('名称', { exact: true }).click();
  await panel.getByRole('button', { name: '上移：名称', exact: true }).click();
  await page.getByRole('button', { name: '强制虚拟' }).click();
  await expect(table.locator('.el-table-v2__header-cell').nth(1)).toHaveText('名称');
  const handle = table.getByRole('button', { name: '调整列宽：名称', exact: true });
  await handle.press('ArrowRight');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('app-table:columns:v1:virtual.fixture')!).widths.name,
    ),
  ).toBeGreaterThan(200);
  await page.getByRole('button', { name: '499行', exact: true }).click();
  await page.getByRole('button', { name: '关闭虚拟' }).click();
  await expect(table).toHaveAttribute('data-render-mode', 'standard');
  await expect(table.locator('th').nth(1)).toHaveText('名称');
  await page.getByRole('button', { name: '隐藏编号', exact: true }).click();
  await page.getByRole('button', { name: '列设置', exact: true }).click();
  await expect(panel.getByRole('checkbox', { name: '编号', exact: true })).toHaveCount(0);
  await expect(panel.getByRole('checkbox', { name: '名称', exact: true })).toBeDisabled();
});

test('invalid saved column settings fall back to defaults', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('app-table:columns:v1:system.menus', '{broken-json'),
  );
  await login(page);
  await expect(page.locator('.el-table__header-wrapper th').nth(2)).toHaveText('菜单名称');
  await page.getByRole('button', { name: '列设置', exact: true }).click();
  await expect(page.getByRole('region', { name: '表格列设置' })).toBeVisible();
});

test('column panel fits dark mobile view and remains usable by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('ui.theme', 'dark'));
  await login(page);
  await page.getByRole('button', { name: '列设置', exact: true }).click();
  const panel = page.getByRole('region', { name: '表格列设置' });
  await expect(page.locator('.table-column-settings-popper:visible')).toHaveCSS('opacity', '1');
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await panel.getByRole('button', { name: '上移：排序', exact: true }).press('Enter');
  const headers = page.locator('.el-table__header-wrapper th');
  await expect(headers.nth(3)).toHaveText('排序');
  await page.screenshot({ path: 'artifacts/table-column-settings-mobile.png', fullPage: true });
});
