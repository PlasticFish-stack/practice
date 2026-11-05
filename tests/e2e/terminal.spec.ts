import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

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
async function login(page: Page, username = 'admin') {
  await page.goto('/playground/terminal');
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function command(page: Page, value: string) {
  const input = page.getByRole('textbox', { name: '终端输入', exact: true });
  await input.pressSequentially(value);
  await input.press('Enter');
}

async function pasteClipboard(page: Page, text: string) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.bringToFront();
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(
    text,
  );
  const input = page.getByRole('textbox', { name: '终端输入', exact: true });
  await input.click();
  // Headless Edge does not dispatch an OS paste for Ctrl+V on this runner.
  // Feed the actual clipboard through xterm's browser paste handler instead.
  await input.evaluate(async (element) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', await navigator.clipboard.readText());
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    );
  });
}

test('local demo treats heredoc as unsupported commands, not a system shell', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await login(page);
  const input = page.getByRole('textbox', { name: '终端输入', exact: true });
  await expect(page.locator('.xterm-rows')).toContainText('本地交互演示');
  await input.press('Control+l');
  await pasteClipboard(page, readFileSync('tests/fixtures/terminal-heredoc.txt', 'utf8'));
  await expect(page.locator('.xterm-rows')).toContainText('wc -l /tmp/terminal-paste-test.txt');
  await input.press('Enter');
  await expect(page.locator('.xterm-rows')).toContainText('EOF: 未提供此演示命令');
  await page.screenshot({ path: 'artifacts/terminal-paste-before.png', fullPage: true });
});

for (const bracketed of [false, true]) {
  test(`gateway preserves complete multiline clipboard input (bracketed paste: ${bracketed})`, async ({
    page,
  }) => {
    const received: string[] = [];
    await page.routeWebSocket('**/api/vps/hosts/demo/terminal', (socket) => {
      socket.send(JSON.stringify({ type: 'ready' }));
      socket.send(
        JSON.stringify({
          type: 'output',
          data: `${bracketed ? '\x1b[?2004h' : ''}paste-ready\r\n$ `,
        }),
      );
      socket.onMessage((data) => {
        if (typeof data !== 'string') return;
        const message = JSON.parse(data);
        if (message.type === 'input') received.push(message.data);
      });
    });
    await login(page);
    await page.getByText('WebSocket 网关', { exact: true }).click();
    await page.getByRole('button', { name: '连接', exact: true }).click();
    await expect(page.locator('.xterm-rows')).toContainText('paste-ready');
    const sample = readFileSync('tests/fixtures/terminal-heredoc.txt', 'utf8');
    await pasteClipboard(page, sample);
    // xterm converts clipboard line endings to terminal carriage returns.
    const normalized = sample.replaceAll('\n', '\r');
    await expect
      .poll(() => received.join(''))
      .toBe(bracketed ? `\x1b[200~${normalized}\x1b[201~` : normalized);
  });
}

test('local command highlighting updates on typing and backspace', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ui.theme', 'light'));
  await login(page);
  const input = page.getByRole('textbox', { name: '终端输入', exact: true });
  const rows = page.locator('.xterm-rows');
  await input.press('Control+l');
  await input.pressSequentially('whoami');
  await expect(rows.getByText('whoami', { exact: true })).toHaveCSS('color', 'rgb(26, 127, 55)');
  await input.pressSequentially('x');
  await expect(rows.getByText('whoamix', { exact: true })).toHaveCSS('color', 'rgb(207, 34, 46)');
  await input.press('Backspace');
  await expect(rows.getByText('whoami', { exact: true })).toHaveCSS('color', 'rgb(26, 127, 55)');
  await input.press('Control+c');
  await input.pressSequentially('echo -n "hello"');
  await expect(rows.getByText('-n', { exact: true })).toHaveCSS('color', 'rgb(27, 124, 131)');
  await expect(rows.getByText('"hello"', { exact: true })).toHaveCSS('color', 'rgb(125, 78, 0)');
  await page.screenshot({ path: 'artifacts/terminal-highlight.png', fullPage: true });
});

test('long local input keeps accepting characters and backspace crosses wrapped rows cleanly', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await login(page);
  const panel = page.getByRole('region', { name: 'VPS Terminal', exact: true });
  await expect(panel).toContainText('本地交互演示');
  const input = page.getByRole('textbox', { name: '终端输入', exact: true });
  await input.press('Control+l');
  await input.pressSequentially('a'.repeat(320));
  const visible = panel.locator('.xterm-rows');
  await expect
    .poll(
      async () => ((await visible.textContent()) ?? '').replaceAll(' ', '').split('a').length - 1,
    )
    .toBe(320);
  await panel.getByRole('button', { name: '清空终端滚屏', exact: true }).click();
  await expect
    .poll(
      async () => ((await visible.textContent()) ?? '').replaceAll(' ', '').split('a').length - 1,
    )
    .toBe(320);
  const dimensions = await page.getByLabel('终端尺寸').textContent();
  await page.setViewportSize({ width: 500, height: 800 });
  await expect(page.getByLabel('终端尺寸')).not.toHaveText(dimensions!);
  await expect
    .poll(
      async () => ((await visible.textContent()) ?? '').replaceAll(' ', '').split('a').length - 1,
    )
    .toBe(320);
  // Clear all wrapped input without leaving repeated prompts or stale fragments.
  for (let index = 0; index < 320; index++) await input.press('Backspace');
  await expect
    .poll(async () => ((await visible.textContent()) ?? '').trim())
    .toBe('demo@vps-demo:~$');
  await command(page, 'echo clean-after-delete');
  await expect(visible).toContainText('clean-after-delete');
});

test('local terminal supports commands, ANSI output, editing, readonly and cached page state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  const panel = page.getByRole('region', { name: 'VPS Terminal', exact: true });
  await expect(panel).toContainText('本地交互演示');
  await command(page, 'whoamix');
  await expect(panel).toContainText('未提供此演示命令');
  const input = page.getByRole('textbox', { name: '终端输入', exact: true });
  await input.pressSequentially('whoamix');
  await input.press('Backspace');
  await input.press('Enter');
  await expect(panel).toContainText('demo');
  await input.press('ArrowUp');
  await input.press('Enter');
  await command(page, 'echo retained-draft');
  await expect(panel).toContainText('retained-draft');
  await page.getByRole('menuitem', { name: '设备列表', exact: true }).click();
  await expect(page).toHaveURL('/device');
  await page.getByRole('tab', { name: '终端演示', exact: true }).click();
  await expect(panel).toContainText('retained-draft');
  await expect(panel.locator('.xterm')).toHaveCount(1);
  const readonly = page
    .locator('.el-switch')
    .filter({ has: page.getByRole('switch', { name: '终端只读模式', exact: true }) });
  await readonly.click();
  await input.focus();
  await page.keyboard.type('echo should-not-appear');
  await page.keyboard.press('Enter');
  await expect(panel).not.toContainText('should-not-appear');
  await readonly.click();
  await command(page, 'echo after-readonly');
  await expect(panel).toContainText('after-readonly');
  await command(page, 'uname -a');
  await command(page, 'free -h');
  await command(page, 'df -h');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const firstLine = await panel.locator('.xterm-rows > div').first().boundingBox();
  await page.mouse.move(firstLine!.x + 2, firstLine!.y + firstLine!.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstLine!.x + 120, firstLine!.y + firstLine!.height / 2, { steps: 6 });
  await page.mouse.up();
  await panel.getByRole('button', { name: '复制终端选中内容', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).not.toBe('');
  await page.screenshot({ path: 'artifacts/terminal-light.png', fullPage: true });
  await panel.getByRole('button', { name: '终端全屏', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains('app-terminal')))
    .toBe(true);
  await panel.getByRole('button', { name: '退出终端全屏', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await input.press('Control+l');
  await expect(panel.locator('.xterm-rows')).not.toContainText('after-readonly');
});

test('terminal fits sidebar, font changes and a dark mobile viewport', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ui.theme', 'dark'));
  await login(page);
  const dimensions = page.getByLabel('终端尺寸');
  const columns = async () => Number((await dimensions.textContent())!.split('×')[0]);
  const before = await columns();
  await page.locator('#aside-btn').click();
  await expect.poll(columns).toBeGreaterThan(before);
  await page.getByRole('spinbutton', { name: '终端字号', exact: true }).fill('18');
  await page.getByRole('spinbutton', { name: '终端字号', exact: true }).press('Enter');
  await expect(page.locator('.xterm-rows')).toHaveCSS('font-size', '18px');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(columns).toBeGreaterThan(8);
  await expect.poll(columns).toBeLessThan(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.app-terminal')).toHaveCSS('background-color', 'rgb(20, 20, 20)');
  await page.screenshot({ path: 'artifacts/terminal-dark-mobile.png', fullPage: true });
});

test('gateway forwards raw input and resize, closes on deactivation and never replays input', async ({
  page,
}) => {
  const connections: string[][] = [];
  await page.routeWebSocket('**/api/vps/hosts/demo/terminal', (socket) => {
    const messages: string[] = [];
    connections.push(messages);
    socket.send(JSON.stringify({ type: 'ready' }));
    socket.send(JSON.stringify({ type: 'output', data: '\x1b[32mremote-ready\x1b[0m\r\n$ ' }));
    socket.onMessage((data) => {
      messages.push(String(data));
      if (typeof data !== 'string') return;
      const message = JSON.parse(data);
      if (message.type === 'input')
        socket.send(
          JSON.stringify({
            type: 'output',
            data: message.data === '\r' ? '\r\nremote-user\r\n$ ' : message.data,
          }),
        );
    });
  });
  await login(page);
  await page.getByText('WebSocket 网关', { exact: true }).click();
  await page.getByRole('button', { name: '连接', exact: true }).click();
  const panel = page.getByRole('region', { name: 'VPS Terminal', exact: true });
  await expect(panel).toContainText('remote-ready');
  await command(page, 'whoami');
  await expect(panel).toContainText('remote-user');
  await page.getByRole('textbox', { name: '终端输入', exact: true }).press('Control+c');
  await expect
    .poll(() => connections[0]!.some((raw) => JSON.parse(raw).data === '\x03'))
    .toBe(true);
  expect(connections[0]!.some((raw) => JSON.parse(raw).type === 'resize')).toBe(true);
  await page.getByRole('menuitem', { name: '设备列表', exact: true }).click();
  await expect(page).toHaveURL('/device');
  await page.getByRole('tab', { name: '终端演示', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('未连接');
  expect(connections).toHaveLength(1);
  await page.getByRole('button', { name: '连接', exact: true }).click();
  await expect(panel).toContainText('remote-ready');
  expect(connections).toHaveLength(2);
  expect(connections[1]!.every((raw) => JSON.parse(raw).type === 'resize')).toBe(true);
});

test('gateway failures stop input and terminal navigation respects page permissions', async ({
  page,
}) => {
  await page.routeWebSocket('**/api/vps/hosts/demo/terminal', (socket) => {
    socket.send(JSON.stringify({ type: 'error', message: '没有该主机的终端访问权限' }));
  });
  await login(page, 'tester');
  await page.getByText('WebSocket 网关', { exact: true }).click();
  await page.getByRole('button', { name: '连接', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('没有该主机的终端访问权限');
  await expect(page.locator('.terminal-status')).toHaveText('连接异常');
  await page.getByRole('button', { name: '账户菜单', exact: true }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await login(page, 'viewer');
  await page.goto('/playground/terminal');
  await expect(page).toHaveURL('/403');
  await expect(page.locator('.app-terminal')).toHaveCount(0);
});
